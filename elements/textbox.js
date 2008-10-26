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

// #ifdef __JTEXTBOX || __JSECRET || __JTEXTAREA || __JINPUT || __INC_ALL
// #define __WITH_PRESENTATION 1

//@todo DOCUMENT the modules too

/**
 * Component displaying a rectangular area wich allows a
 * user to type information. The information typed can be
 * restricted by using masking. The information can also
 * be hidden from view when used in password mode. Furthermore
 * by supplying a dataset information typed can autocomplete.
 *
 * @classDescription		This class creates a new textbox
 * @return {Textbox} Returns a new textbox
 * @type {Textbox}
 * @constructor
 * @alias jpf.input
 * @alias jpf.secret
 * @alias jpf.textarea
 * @allowchild autocomplete
 * @addnode components:textbox, components:secret, components:input, components:textarea
 *
 * @author      Ruben Daniels
 * @version     %I%, %G%
 * @since       0.1
 */
//XForms support

jpf.input    =
jpf.secret   =
jpf.textarea = 
jpf.textbox  = function(pHtmlNode, tagName){
    jpf.register(this, tagName || "textbox", jpf.NODE_VISIBLE);/** @inherits jpf.Class */
    this.pHtmlNode = pHtmlNode || document.body;
    this.pHtmlDoc  = this.pHtmlNode.ownerDocument;
    
    /* ***********************
            Inheritance
    ************************/
    this.inherit(jpf.Presentation); /** @inherits jpf.Presentation */
    //#ifdef __WITH_DATABINDING
    this.inherit(jpf.DataBinding); /** @inherits jpf.DataBinding */
    //#endif

    /* ********************************************************************
                                        PROPERTIES
    *********************************************************************/
    
    //Options
    this.$focussable       = true; // This object can get the focus
    this.realtime          = false;
    this.isContentEditable = true;
    this.multiline         = this.tagName == "textarea" ? true : false;
    
    //#ifdef __WITH_VALIDATION
    this.inherit(jpf.Validation); /** @inherits jpf.Validation */
    //#endif
    //#ifdef __WITH_XFORMS
    this.inherit(jpf.XForms); /** @inherits jpf.XForms */
    //#endif
    
    var masking            = false;
    var _self              = this;
    
    /* ********************************************************************
                                        PUBLIC METHODS
    *********************************************************************/

    this.setValue = function(value){
        return this.setProperty("value", value);
    };
    
    this.$clear = function(){
        this.value = "";
        
        if (this.oInt.tagName.toLowerCase().match(/input|textarea/i))
            this.oInt.value = "";
        else {
            this.oInt.innerHTML = "";
            //try{this.oInt.focus();}catch(e){}
            
            if (!jpf.hasMsRangeObject) return;
            
            //will fail when object isn't visible
            //N.B. why a select in a clear function.. isn't consistent...
            try {
                var range = document.selection.createRange();
                range.moveStart("sentence", -1);
                //range.text = "";
                range.select();
            }
            catch(e) {}
        }
    };
    
    this.getValue = function(){
        return this.isHTMLBox ? this.oInt.innerHTML : this.oInt.value;
    };
    
    this.insert = function(text){
        if (jpf.hasMsRangeObject) {
            try {
                this.oInt.focus();
            }
            catch(e) {}
            var range = document.selection.createRange();
            if (this.oninsert)
                text = this.oninsert(text);
            range.pasteHTML(text);
            range.collapse(true);
            range.select();
        }
        else {
            this.oInt.value += text;
        }
    };
    
    this.$enable  = function(){ this.oInt.disabled = false; };
    this.$disable = function(){ this.oInt.disabled = true; };
    this.select   = function(){ this.oInt.select(); };
    this.deselect = function(){ this.oInt.deselect(); };
    
    /* ********************************************************************
                                        PRIVATE METHODS
    *********************************************************************/

    this.$insertData = function(str){
        return this.setValue(str);
    };
    
    //Normal
    this.$keyHandler = function(key, ctrlKey, shiftKey, altKey, e){
        if (this.dispatchEvent("keydown", {
            keyCode   : key,
            ctrlKey   : ctrlKey,
            shiftKey  : shiftKey,
            altKey    : altKey,
            htmlEvent : e}) === false)
                return false;

        // @todo: revisit this IF statement - dead code?
        if (false && jpf.isIE && (key == 86 && ctrlKey || key == 45 && shiftKey)) {
            var text = window.clipboardData.getData("Text");
            if ((text = this.dispatchEvent("keydown", {
                text : this.onpaste(text)}) === false))
                    return false;
            if (!text)
                text = window.clipboardData.getData("Text");
            
            this.oInt.focus();
            var range = document.selection.createRange();
            range.text = "";
            range.collapse();
            range.pasteHTML(text.replace(/\n/g, "<br />").replace(/\t/g, "&nbsp;&nbsp;&nbsp;"));
            
            return false;
        }
    };
    
    /* ***********************
                Focus
    ************************/
    
    var fTimer;
    this.$focus = function(e){
        if (!this.oExt || this.oExt.disabled) 
            return;
            
        this.$setStyleClass(this.oExt, this.baseCSSname + "Focus");
        
        function delay(){
            try {
                if (!fTimer || document.activeElement != _self.oInt) {
                    _self.oInt.focus();
                }
                else {
                    clearInterval(fTimer);
                    return;
                }
            }
            catch(e) {}
            
            if (masking)
                _self.setPosition();
    
            if (_self.focusselect)
                _self.select();
        };

        if (e && e.mouse && jpf.isIE) {
            clearInterval(fTimer);
            fTimer = setInterval(delay, 1);
        }
        else
            delay();
    };
    
    this.$blur = function(e){
        if (!this.oExt) 
            return;

        this.$setStyleClass(this.oExt, "", [this.baseCSSname + "Focus"]);

        if (jpf.hasMsRangeObject) {
            var r = this.oInt.createTextRange();
            r.collapse();
            r.select();
        }

        try {
            if (jpf.isIE || !e || e.srcElement != jpf.window)
                this.oInt.blur();
        }
        catch(e) {}
        
        if (!this.realtime)
            this.change(this.getValue());
            
        // check if we clicked on the oContainer. ifso dont hide it
        if (this.oContainer) {
            setTimeout("var o = jpf.lookup(" + this.uniqueId + ");\
                o.oContainer.style.display = 'none'", 100);
        }
    };
    
    /* ***********************
          Properties
    ************************/
    
    this.$booleanProperties["focusselect"] = true;
    this.$supportedProperties.push("value", "mask", "initial", 
        "focusselect", "realtime");

    this.$propHandlers["value"] = function(value){
        // Set Value
        if (this.isHTMLBox) {
            if (this.oInt.innerHTML != value)
                this.oInt.innerHTML = value;
        }
        else
            if (this.oInt.value != value) {
                this.oInt.value = value;
            }
    };
    
    this.$propHandlers["maxlength"] = function(value){
        this.$setRule("maxlength", value
            ? "value.toString().length <= " + value
            : null);
        
        //Special validation support using nativate max-length browser support
        if (this.oInt.tagName.toLowerCase().match(/input|textarea/))
            this.oInt.maxLength = parseInt(value) || null;
    };
    
    this.$propHandlers["mask"] = function(value){
        if (jpf.hasMsRangeObject || this.mask == "PASSWORD")
            return;
        
        if (!value) {
            throw new Error("Not Implemented");
        }
            
        if (!masking) {
            masking = true;
            this.inherit(jpf.textbox.masking); /** @inherits jpf.textbox.masking */
            this.focusselect = false;
            this.realtime    = false;
        }
        
        this.setMask(this.mask);
    };

    /**
     * @attribute {String} initial-message the message displayed by this element
     * when it doesn't have a value set. This property is inherited from parent 
     * nodes. When none is found it is looked for on the appsettings element. 
     
    this.$propHandlers["initial-message"] = function(value){
        this.initialMsg = value 
            || jpf.xmldb.getInheritedAttribute(this.$jml, "empty-message");
    };*/

    this.$propHandlers["initial"] = function(value){
        if (value) {
            this.oInt.onblur();
            this.setValue(value);
        }
    };

    this.$propHandlers["realtime"] = function(value){
        this.realtime = value || jpf.xmldb.getInheritedAttribute(x, "value") || false;
    };
    
    this.$propHandlers["focusselect"] = function(value){
        this.oInt.onmousedown = function(){
            _self.focusselect = false;
        };
        
        this.oInt.onmouseup  = 
        this.oInt.onmouseout = function(){
            _self.focusselect = value;
        };
    };
    
    /* *********
        INIT
    **********/
    this.inherit(jpf.JmlElement); /** @inherits jpf.JmlElement */
    
    this.$draw = function(){
        //Build Main Skin
        this.oExt = this.$getExternal(null, null, function(oExt){
            if (this.$jml.getAttribute("mask") == "PASSWORD"
              || "secret|password".indexOf(this.tagName) > -1
              || this.$jml.getAttribute("type") == "password") {
                this.$jml.removeAttribute("mask");
                this.$getLayoutNode("main", "input").setAttribute("type", "password");
            }
            //#ifdef __WITH_HTML5
            else if (this.tagName == "email") {
                this.datatype = "jpf:email";
                this.$propHandlers["datatype"].call(this, "jpf:email");
            }
            else if (this.tagName == "url") {
                this.datatype = "jpf:url";
                this.$propHandlers["datatype"].call(this, "jpf:url");
            }
            //#endif
            
            oExt.setAttribute("onmousedown", "this.host.dispatchEvent('mousedown', {htmlEvent : event});");
            oExt.setAttribute("onmouseup",   "this.host.dispatchEvent('mouseup', {htmlEvent : event});");
            oExt.setAttribute("onclick",     "this.host.dispatchEvent('click', {htmlEvent : event});");
        }); 
        this.oInt = this.$getLayoutNode("main", "input", this.oExt);	
        
        if (!jpf.hasContentEditable && "input|textarea".indexOf(this.oInt.tagName.toLowerCase()) == -1) {
            var node  = this.oInt;
            this.oInt = node.parentNode.insertBefore(document.createElement("textarea"), node);
            node.parentNode.removeChild(node);
            this.oInt.className = node.className;
            if (this.oExt == node)
                this.oExt = this.oInt;
        }
        
        //@todo for skin switching this should be removed
        if (this.oInt.tagName.toLowerCase() == "textarea") {
            this.addEventListener("focus", function(e){
                //if (this.multiline != "optional")
                    //e.returnValue = false
            });
        }
        
        this.oInt.onselectstart = function(e){
            if (!e) e = event;
            e.cancelBubble = true;
        }
        this.oInt.host          = this;
        
        //temp fix
        this.oInt.onkeydown = function(e){
            if (this.disabled) return false;
            
            e = e || window.event;
            
            //Change
            if (!this.host.realtime)
                if (e.keyCode == 13)
                    this.host.change(this.host.getValue());
            else
                if (jpf.isSafari && this.host.xmlRoot) //safari issue (only old??)
                    setTimeout("var o = jpf.lookup(" + this.host.uniqueId + ");\
                        o.change(o.getValue())");
            
            if (_self.multiline == "optional" && e.keyCode == 13 && !e.ctrlKey)
                return false;
            
            if (e.ctrlKey && (e.keyCode == 66 || e.keyCode == 73
              || e.keyCode == 85))
                return false; 
            
            //Autocomplete
            if (this.host.oContainer) {
                var oTxt    = this.host;
                var keyCode = e.keyCode;
                setTimeout(function(){
                    oTxt.fillAutocomplete(keyCode);
                });
            }
            
            //Non masking
            if (!this.host.mask) {
                return this.host.$keyHandler(e.keyCode, e.ctrlKey,
                    e.shiftKey, e.altKey, e);
            }
        };
        
        this.oInt.onkeyup = function(e){
            if (!e)
                e = event;
            
            var keyCode = e.keyCode;

            if (this.host.realtime) {
                setTimeout(function(){
                    if (!_self.mask)
                        _self.change(_self.getValue()); //this is a hack
                    _self.dispatchEvent("keyup", {keyCode : keyCode});
                });
            }
            else {
                _self.dispatchEvent("keyup", {keyCode : keyCode});
            }
            
            //#ifdef __WITH_VALIDATION
            if (this.host.isValid() && e.keyCode != 13)
                this.host.clearError();
            //#endif
        };
        
        this.oInt.onfocus = function(){
            if (_self.initial && this.value == _self.initial) {
                this.value = "";
                jpf.setStyleClass(_self.oExt, "", [_self.baseCSSname + "Initial"]);
            }
            
            //#ifdef __WITH_WINDOW_FOCUS
            if (jpf.hasFocusBug)
                jpf.window.$focusfix2();
            //#endif
        };
        
        this.oInt.onblur = function(){
            if (_self.initial && this.value == "") {
                this.value = _self.initial;
                jpf.setStyleClass(this.host.oExt, _self.baseCSSname + "Initial");
            }
            
            //#ifdef __WITH_WINDOW_FOCUS
            if (jpf.hasFocusBug)
                jpf.window.$blurfix();
            //#endif
        };
        
        if (jpf.hasAutocompleteXulBug)
            this.oInt.setAttribute("autocomplete", "off");

        if (!this.oInt.tagName.toLowerCase().match(/input|textarea/)) {
            this.isHTMLBox = true;
            
            this.oInt.unselectable    = "Off";
            this.oInt.contentEditable = true;
            this.oInt.style.width     = "1px";
            
            this.oInt.select = function(){
                var r = document.selection.createRange();
                r.moveToElementText(this);
                r.select();
            }
        };
        
        this.oInt.deselect = function(){
            if (!document.selection) return;
            
            var r = document.selection.createRange();
            r.collapse();
            r.select();
        };
    };

    this.$loadJml = function(x){
        //Autocomplete
        var ac = $xmlns(x, "autocomplete", jpf.ns.jpf)[0];
        if (ac) {
            this.inherit(jpf.textbox.autocomplete); /** @inherits jpf.textbox.autocomplete */
            this.initAutocomplete(ac);
        }
        
        //@todo move this to a prop handler??
        if (this.type && "password|username".indexOf(this.type) > -1
          && typeof this.focusselect == "undefined") {
            this.focusselect = true;
            this.$propHandlers["focusselect"].call(this, true);
        }
        
        if (jpf.xmldb.isOnlyChild(x.firstChild, [3,4]))
            this.$handlePropSet("value", x.firstChild.nodeValue.trim());
        else
            jpf.JmlParser.parseChildren(this.$jml, null, this);
    };
    
    this.$destroy = function(){
        this.oInt.onkeypress = this.oInt.onmouseup = this.oInt.onmouseout = 
        this.oInt.onmousedown = this.oInt.onkeydown = this.oInt.onkeyup = 
        this.oInt.onselectstart = null;
    };
}

// #endif
