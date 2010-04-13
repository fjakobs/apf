/*
 * See the NOTICE file distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation; either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this software; if not, write to the Free
 * Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301 USA, or see the FSF site: http://www.fsf.org.
 *
 */

//#ifdef __WITH_CONTENTEDITABLE

apf.visualSelect = function(selection){
    this.$init();

    var _self = this;
    selection.addEventListener("update", function(){
        _self.updateSelection();
    });
    this.$selection = selection;
};

(function(){
    var nodes = [],
        pos   = ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
        div,
        inited = false;

    function init(){
        while (nodes.length != 8) {
            div = document.body.appendChild(document.createElement("div"));
            div.className = "idegrabber";
            div.style.display = "none";
            div.onmousedown = mousedown;
            div.self = this;
            
            nodes.push(div);
            nodes[(div.type = pos.pop())] = div;
        }
        
        var oOutline = document.body.appendChild(document.createElement("div"));
        oOutline.style.position  = "absolute";
        oOutline.style.display   = "none";
        oOutline.style.border    = "2px solid gray";
        oOutline.style.zIndex    = 1000000;
        oOutline.style.overflow  = "hidden";
        oOutline.style.minHeight = "3px";
        oOutline.style.minWidth  = "3px";
        
        inited = true;
    }
    
    var selected = [], anchors,
        size   = 8,
        margin = 1;

    this.show = function(){
        this.visible = true;
        for (var i = 0; i < 8; i++)
            nodes[i].style.display = "block";
    };
    
    this.hide = function(){
        this.visible = false;
        for (var i = 0; i < 8; i++)
            nodes[i].style.display = "none";
    };
    
    this.$finishResize = function(){
        apf.setStyleClass(resizing, "", ["idegrabber_resizing"]);
        resizing = false;
        this.updateGeo();
    }

    var lastSelection = [];
    this.updateSelection = function(){
        var nodes = this.$selection.$getNodeList();
        
        if (!inited)
            init.call(this);
        
        //#ifdef __WITH_LAYOUT
        for (var s, i = 0, l = lastSelection.length; i < l; i++) {
            if (nodes.indexOf(s = lastSelection[i]) == -1) {
                apf.layout.removeRule(s.$ext, "visualselect");
                apf.layout.activateRules(s.$ext);
            }
        }
        for (i = 0, l = nodes.length; i < l; i++) {
            if (lastSelection.indexOf(s = nodes[i]) == -1) {
                apf.layout.setRules(s.$ext, "visualselect", "apf.all[" 
                    + this.$uniqueId + "].updateGeo()", true);
                apf.layout.queue(s.$ext);
            }
        }
        lastSelection = nodes;
        //#endif

        if (!nodes.length)
            return this.hide();

        this.updateGeo();
        
        //Show
        if (!this.visible)
            this.show();
    }
    
    this.getLastSelection = function(){
        return lastSelection;
    }
    
    var lastPos, txt;
    this.updateGeo = function(force){
        var selection = lastSelection;

        //Position
        if (selection.length == 1) {
            var sel = selection[0];
            
            if (sel.$adding)
                return;
            
            var anchors = selection.length == 1
              ? (sel.$anchors && sel.$anchors.length 
                ? sel.$anchors
                : [sel.top, sel.right, sel.bottom, sel.left])
              : [];

            //!apf.dragMode && 
            if (anchors && !resizing && !this.renaming) {
                var pel = sel.parentNode;
                var name = pel.localName;
                var exclPNode = "table|vbox|hbox".indexOf(name) > -1;
                var fullDisabled = name == "vbox" && String(sel.height).indexOf("%") > -1 
                    || name == "hbox" && String(sel.width).indexOf("%") > -1;

                var pack = sel.align || pel.pack;

                apf.setStyleClass(nodes.n, fullDisabled || name == "table" || name == "vbox" && pack == "start" || name == "hbox" 
                    ? "idegrabber_disabled"
                    : (!exclPNode && (anchors[0] || anchors[0] === 0)
                        ? "idegrabber_selected" 
                        : ""), ["idegrabber_selected", "idegrabber_disabled"]);
                apf.setStyleClass(nodes.e, fullDisabled || name == "table" || name == "hbox" && pack == "end"
                    ? "idegrabber_disabled"
                    : (!exclPNode && (anchors[1] || anchors[1] === 0)
                        ? "idegrabber_selected" 
                        : ""), ["idegrabber_selected", "idegrabber_disabled"]);
                apf.setStyleClass(nodes.s, fullDisabled || name == "vbox" && pack == "end" 
                    ? "idegrabber_disabled"
                    : (!exclPNode && (anchors[2] || anchors[2] === 0)
                        ? "idegrabber_selected" 
                        : ""), ["idegrabber_selected", "idegrabber_disabled"]);
                apf.setStyleClass(nodes.w, fullDisabled || name == "table" || name == "vbox" || name == "hbox" && pack == "start" 
                    ? "idegrabber_disabled"
                    : (!exclPNode && ( anchors[3] || anchors[3] === 0)
                        ? "idegrabber_selected" 
                        : ""), ["idegrabber_selected", "idegrabber_disabled"]);

                apf.setStyleClass(nodes.nw, fullDisabled || name == "table" || name == "vbox" && pack == "start" || name == "hbox"
                    ? "idegrabber_disabled" : "", ["idegrabber_disabled"]);
                apf.setStyleClass(nodes.ne, fullDisabled || name == "table" || name == "hbox" && pack == "end"
                    ? "idegrabber_disabled" : "", ["idegrabber_disabled"]);
                apf.setStyleClass(nodes.sw, fullDisabled || name == "vbox" && pack == "end"
                    ? "idegrabber_disabled" : "", ["idegrabber_disabled"]);
                apf.setStyleClass(nodes.se, fullDisabled
                    ? "idegrabber_disabled" : "", ["idegrabber_disabled"]);
            
                this.$selection.dispatchEvent("update-content", {sel: sel});
            }
            
            var oHtml = sel.$ext;//this.$ext;
            
            if (!oHtml.offsetParent)
                return; //@error

            //oHtml.offsetParent.appendChild(oOutline); 
            if (apf.isIE) //@notice this solves an IE drawing bug
                oHtml.parentNode.appendChild(txt || (txt = document.createTextNode("")));
            
            var pos = apf.getAbsolutePosition(oHtml);
            pos.push(oHtml.offsetWidth, oHtml.offsetHeight);
        }
        else {
            //@todo fix classes??
            
            var oHtml, opos, pos = [100000,100000,0,0];
            for (var i = 0; i < selection.length; i++) {
                oHtml  = selection[i].$ext;
                opos   = apf.getAbsolutePosition(oHtml);
                
                if (opos[0] < pos[0]) pos[0] = opos[0];
                if (opos[1] < pos[1]) pos[1] = opos[1];
                if (opos[0] + oHtml.offsetWidth > pos[2]) pos[2] = opos[0] + oHtml.offsetWidth;
                if (opos[1] + oHtml.offsetHeight > pos[3]) pos[3] = opos[1] + oHtml.offsetHeight;
            }
            
            if (!oHtml.offsetParent)
                return; //@error
                
            //oHtml.offsetParent.appendChild(oOutline);
            if (apf.isIE) //@notice this solves an IE drawing bug
                oHtml.parentNode.appendChild(txt || (txt = document.createTextNode("")));
            
            pos[2] -= pos[0];
            pos[3] -= pos[1];
        }

        /*if (oOutline.parentNode.tagName == "BODY") {
            var ppos = apf.getAbsolutePosition(document.documentElement, null, true);
            ppos[0] += (apf.isIE ? 2 : 0);
            ppos[1] += (apf.isIE ? 2 : 0);
        }
        else
            var ppos = apf.getAbsolutePosition(oOutline.parentNode, null, true);

        lastPos = pos.slice();
        lastPos[0] -= ppos[0];
        lastPos[1] -= ppos[1];
        
        var x, y, w, h, diff = apf.getDiff(oOutline);
        oOutline.style.left  = (x = lastPos[0]) + "px";
        oOutline.style.top   = (y = lastPos[1]) + "px";
        oOutline.style.width = (w = Math.max(0, pos[2] - diff[0])) + "px";
        oOutline.style.height = (h = Math.max(0, pos[3] - diff[1])) + "px";
        
        apf.config.setProperty("x", x);
        apf.config.setProperty("y", y);
        apf.config.setProperty("w", w);
        apf.config.setProperty("h", h);*/

        //Middle ones (hor)
        nodes.s.style.left = 
        nodes.n.style.left = (pos[0] + (pos[2] - size)/2) + "px";
        
        //Middle ones (ver)
        nodes.e.style.top = 
        nodes.w.style.top = (pos[1] + (pos[3] - size)/2) + "px";
        
        //Top
        nodes.nw.style.top = 
        nodes.ne.style.top = 
        nodes.n.style.top  = (pos[1] - size - margin) + "px";
        
        //Left
        nodes.sw.style.left = 
        nodes.nw.style.left = 
        nodes.w.style.left  = (pos[0] - size - margin) + "px";
        
        //Right
        nodes.ne.style.left = 
        nodes.se.style.left = 
        nodes.e.style.left  = (pos[0] + pos[2] + margin) + "px";
        
        //Bottom
        nodes.se.style.top = 
        nodes.sw.style.top = 
        nodes.s.style.top  = (pos[1] + pos[3] + margin) + "px";
    };
    
    var resizing, map = {"e":"right", "w":"left", "n":"top", "s":"bottom"};
    function mousedown(e){
        if (!e) e = event;
        
        var docsel = this.self.$selection;
        if (e.button == 2 || docsel.rangeCount > 1)
            return;
        
        var sel  = docsel.$getFirstNode();
        var doc  = docsel.$ownerDocument;
        var name = sel.parentNode.localName;
        var type = this.type;
        
        doc.$commands.begin.call(doc);
        
        if (e.ctrlKey && type.length == 1) {
            if (sel.$anchors && sel.$anchors.length) {
                var anchors = sel.$anchors;
                sel.setAttribute("anchors", null);
                sel.setAttribute("top", anchors[0]);
                sel.setAttribute("right", anchors[1]);
                sel.setAttribute("bottom", anchors[2]);
                sel.setAttribute("left", anchors[3]);
            }
            
            var value = sel[map[type]];
            apf.setStyleClass(this, !value && value !== 0 
                ? "idegrabber_selected" : "", ["idegrabber_selected"]);

            var pHtmlNode = sel.$ext.offsetParent;
            if (pHtmlNode.tagName == "BODY")
                pHtmlNode = document.documentElement;

            var prop = map[type];
            if (sel[prop] || sel[prop] === 0) {
                if (prop == "right" && !this.left && this.left !== 0)
                    sel.setAttribute("left", apf.getHtmlLeft(sel.$ext));
                else if (prop == "bottom" && !this.top && this.top !== 0)
                    sel.setAttribute("top", apf.getHtmlTop(sel.$ext));

                sel.setAttribute(prop, "");
            }
            else {
                switch(type) {
                    case "e":
                        sel.setAttribute("right", apf.getHtmlRight(sel.$ext));
                        break;
                    case "w":
                        sel.setAttribute("left", apf.getHtmlLeft(sel.$ext));
                        break;
                    case "n":
                        sel.setAttribute("top", apf.getHtmlTop(sel.$ext));
                        break;
                    case "s":
                        sel.setAttribute("bottom", apf.getHtmlBottom(sel.$ext));
                        break;
                }
            }

            sel.setAttribute("width", !this.left && this.left !== 0 || !this.right && this.right !== 0
                ? sel.$ext.offsetWidth
                : null);
            sel.setAttribute("height", !this.top && this.right !== 0 || !this.bottom && this.bottom !== 0
                ? sel.$ext.offsetHeight
                : null);
            
            doc.$commands.commit.call(doc);
        }
        else {
            sel.$resizeStart(e || event, {
                resizeType : type,
                nocursor   : true
            });
            
            resizing = this;
            apf.setStyleClass(this, "idegrabber_resizing");
        }
    }
}).call(apf.visualSelect.prototype = new apf.Class());

//#endif