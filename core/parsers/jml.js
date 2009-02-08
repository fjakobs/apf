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

// #ifdef __WITH_TELEPORT || __PARSER_JML
/**
 * The parser of the Javeline Markup Language. It parses other namespaces as
 * well, such as html and xsd.
 * @parser
 * @private
 */
jpf.JmlParser = {
    // #ifdef __WITH_DATABINDING
    sbInit     : {},
    // #endif

    stateStack : [],
    modelInit  : [],

    parse : function(x){
        // #ifdef __DEBUG
        jpf.console.info("Start parsing main application");
        // #endif
        // #ifdef __DEBUG
        jpf.Latometer.start();
        // #endif
        this.$jml = x;

        jpf.isParsing = true;

        // #ifdef __DEBUG
        //Check for children in Jml node
        if (!x.childNodes.length)
            throw new Error(jpf.formatErrorString(1014, null,
                "jpf.JmlParser",
                "JML Parser got Markup without any children"));
        // #endif

        //Create window and document
        jpf.window          = new jpf.WindowImplementation();
        jpf.document        = new jpf.DocumentImplementation();
        jpf.window.document = jpf.document;
        //#ifdef __WITH_ACTIONTRACKER
        jpf.window.$at      = new jpf.actiontracker();
        jpf.window.$at.name = "default";
        jpf.nameserver.register("actiontracker", "default", jpf.window.$at);
        //#endif

        //First pass parsing of all JML documents
        for (var docs = [x], i = 0; i < jpf.includeStack.length; i++) {
            if (jpf.includeStack[i].nodeType)
                docs.push(jpf.includeStack[i]);
        }

        this.docs = docs;
        this.parseSettings(docs);

        if (!this.shouldWait)
            this.continueStartup();
    },

    //Allow for Async processes set in appsettings to load before parsing...
    continueStartup : function(){
        this.parseFirstPass(this.docs);

        //Main parsing pass
        jpf.JmlParser.parseChildren(this.$jml, document.body, jpf.document.documentElement);//, this);

        //Activate Layout Rules [Maybe change idef to something more specific]
        //#ifdef __WITH_ALIGNMENT
        if (jpf.appsettings.layout)
            jpf.layout.loadFrom(jpf.appsettings.layout);
        // #endif

        //Last pass parsing
        setTimeout('jpf.JmlParser.parseLastPass();', 1);

        //Set init flag for subparsers
        this.inited = true;

        // #ifdef __DEBUG
        jpf.Latometer.end();
        jpf.Latometer.addPoint("Total load time");
        jpf.Latometer.start(true);
        // #endif
    },

    parseSettings : function(xmlDocs) {
        for (var i = 0; i < xmlDocs.length; i++)
            this.preLoadRef(xmlDocs[i], ["appsettings"]);
    },

    parseFirstPass: function(xmlDocs){
        // #ifdef __DEBUG
        jpf.console.info("Parse First Pass");
        // #endif

        //@todo fix inline skin parsing collision
        //"presentation", 
        for (var i = 0; i < xmlDocs.length; i++)
            this.preLoadRef(xmlDocs[i], ["teleport", "settings",
                "skin[not(@j_preparsed=9999)]", "bindings[@id]", "actions[@id]", "dragdrop[@id]", "remote"]);
        //"style", 
        for (var i = 0; i < xmlDocs.length; i++)
            this.preLoadRef(xmlDocs[i], ["model[@id]",
                "smartbinding[@id]", "iconmap"], true);
    },

    preparsed : [],
    preLoadRef : function(xmlNode, sel, parseLocalModel){
        /*BUG: IE document handling bugs
        - removed to see what this does
        if (jpf.isIE) {
            if (xmlNode.style) return;
        }*/

        var prefix = jpf.findPrefix(xmlNode, jpf.ns.jml);
        if (prefix) prefix += ":";
        var nodes  = jpf.xmldb.selectNodes(".//" + prefix + sel.join("|.//"
            + prefix) + (parseLocalModel ? "|" + prefix + "model" : ""), xmlNode);

        var i, o, name, tagName, x, l;
        for (i = 0, l = nodes.length; i < l; i++) {
            x = nodes[i];

            //Check if node should be rendered
            if (jpf.xmldb.getInheritedAttribute(x, "render") == "runtime")
                continue;

            var tagName = x[jpf.TAGNAME];

            //Process Node
            if (this.handler[tagName]) {
                //#ifdef __DEBUG
                jpf.console.info("Processing [preload] " + tagName + " node");
                //#endif

                o = this.handler[tagName](x);
                name = x.getAttribute("id"); //or u could use o.name

                //Add this component to the nameserver
                if (o && name)
                    jpf.nameserver.register(tagName, name, o);

                //#ifdef __WITH_JMLDOM_FULL
                if (!o || !o.nodeType)
                    o = new jpf.JmlDom(tagName, null, jpf.NODE_HIDDEN, x, o);
                //#endif

                o.$jmlLoaded = true;

                if (name) jpf.setReference(name, o);

                x.setAttribute("j_preparsed", this.preparsed.push(o) - 1);
            }
            else if (x.parentNode) {
               x.parentNode.removeChild(x);
            }
        }
    },

    parseMoreJml : function(x, pHtmlNode, jmlParent, noImpliedParent, parseSelf, beforeNode){
        var parsing = jpf.isParsing;
        jpf.isParsing = true;

        if (!jpf.window) {
            jpf.window          = new jpf.WindowImplementation();
            jpf.document        = new jpf.DocumentImplementation();
            // #ifdef __WITH_ACTIONTRACKER
            jpf.window.document = jpf.document;
            jpf.window.$at      = new jpf.actiontracker();
            jpf.nameserver.register("actiontracker", "default", jpf.window.$at);
            //#endif
        }

        if (!jmlParent)
            jmlParent = jpf.document.documentElement;

        this.parseFirstPass([x]);

        if (parseSelf) {
            if (jmlParent.loadJml)
                jmlParent.loadJml(x, jmlParent.parentNode);
            jmlParent.$jmlLoaded = true;

            //#ifdef __WITH_ALIGNMENT
            if (jmlParent && jmlParent.pData)
                jpf.layout.compileAlignment(jmlParent.pData);
            //#endif

            //#ifdef __WITH_ANCHORING || __WITH_ALIGNMENT || __WITH_GRID
            if (jmlParent.pData || jmlParent.tagName == "grid")
                jpf.layout.activateRules(pNode.oInt || document.body);
            //#endif
        }
        else {
            var lastChild = pHtmlNode.lastChild;
            this.parseChildren(x, pHtmlNode, jmlParent, false, noImpliedParent);

            if (beforeNode) {
                var loop = pHtmlNode.lastChild;
                while (lastChild != loop) {
                    pHtmlNode.insertBefore(loop, beforeNode);
                    loop = pHtmlNode.lastChild;
                }
            }
        }

        //#ifdef __WITH_ANCHORING || __WITH_ALIGNMENT || __WITH_GRID
        jpf.layout.activateRules();//@todo maybe use processQueue
        //#endif

        this.parseLastPass();
        jpf.isParsing = parsing;
    },

    reWhitespaces : /[\t\n\r]+/g,
    parseChildren : function(x, pHtmlNode, jmlParent, checkRender, noImpliedParent){
        //Let's not parse our children when they're already rendered
        if (pHtmlNode == jmlParent.oInt && jmlParent.childNodes.length
          && jmlParent != jpf.document.documentElement)
            return pHtmlNode;

        // #ifdef __DEBUG
        if (!jpf.Latometer.isStarted) jpf.Latometer.start();
        // #endif

        // Check for delayed rendering flag
        if (checkRender && jmlParent && jmlParent.hasFeature(__DELAYEDRENDER__)
          && jmlParent.$checkDelay(x)) {
            // #ifdef __DEBUG
            jpf.console.info("Delaying rendering of children");
            // #endif

            return pHtmlNode;
        }
        if (jmlParent)
            jmlParent.isRendered = true;

        if (x.namespaceURI == jpf.ns.jml || x.tagUrn == jpf.ns.jml)
            this.lastNsPrefix = x.prefix || x.scopeName;

        //Loop through Nodes
        for (var oCount = 0,i = 0; i < x.childNodes.length; i++) {
            var q = x.childNodes[i];
            if (q.nodeType == 8) continue;

            // Text nodes and comments
            if (q.nodeType != 1) {
                if (!pHtmlNode) continue;

                if (jpf.isIE && !q.nodeValue.trim())
                    continue;

                if (q.nodeType == 3 || pHtmlNode.style && q.nodeType == 4) {
                    //if(jmlParent.name == "barTest") debugger;
                    pHtmlNode.appendChild(pHtmlNode.ownerDocument
                      .createTextNode(!jpf.hasTextNodeWhiteSpaceBug
                      ? q.nodeValue
                      : q.nodeValue.replace(this.reWhitespaces, " ")));

                }
                else if (q.nodeType == 4) {
                    pHtmlNode.appendChild(pHtmlNode.ownerDocument
                        .createCDataSection(q.nodeValue));
                }

                //#ifdef __WITH_LANG_SUPPORT
                jpf.language.addElement(q.nodeValue.replace(/^\$(.*)\$$/,
                    "$1"), {htmlNode : pHtmlNode});
                //#endif
                continue;
            }

            //Parse node using namespace handler
            if (!this.nsHandler[q.namespaceURI || q.tagUrn || jpf.ns.xhtml])
                continue; //ignore tag

            this.nsHandler[q.namespaceURI || q.tagUrn || jpf.ns.xhtml].call(
                this, q, pHtmlNode, jmlParent, noImpliedParent);
        }

        if (pHtmlNode) {
            //Calculate Alignment and Anchoring
            // #ifdef __WITH_ALIGNMENT
            if (jmlParent && jmlParent.pData)
                jpf.layout.compileAlignment(jmlParent.pData);
                //jpf.layout.compile(pHtmlNode);
            // #endif

            // #ifdef __WITH_ANCHORING || __WITH_ALIGNMENT || __WITH_GRID
            jpf.layout.activateRules(pHtmlNode);
            // #endif
        }

        return pHtmlNode;
    },

    addNamespaceHandler : function(xmlns, func){
        this.nsHandler[xmlns] = func;
    },

    /**
     * @define include element that loads another jml files.
     * Example:
     * <code>
     *   <j:include src="bindings.jml" />
     * </code>
     * @attribute {String} src the location of the jml file to include in this application.
     * @addnode global, anyjml
     */
    /**
     * @private
     */
    nsHandler : {
        //Javeline PlatForm
        "http://www.javeline.com/2005/jml" : function(x, pHtmlNode, jmlParent, noImpliedParent){
            var tagName = x[jpf.TAGNAME];

            // #ifdef __WITH_INCLUDES
            // Includes
            if (tagName == "include") {
                // #ifdef __DEBUG
                jpf.console.info("Switching to include context");
                // #endif

                var xmlNode = jpf.includeStack[x.getAttribute("iid")];
                //#ifdef __DEBUG
                if (!xmlNode)
                    return jpf.console.warn("No include file found");
                // #endif

                this.parseChildren(xmlNode, pHtmlNode, jmlParent, null, true);
            }
            else
            // #endif

            // Handler
            if (this.handler[tagName]) {
                var o, id, name;

                //Deal with preparsed nodes
                if (id = x.getAttribute("j_preparsed")) {
                    x.removeAttribute("j_preparsed");

                    o = this.preparsed[id];
                    delete this.preparsed[id];

                    if (o && !o.parentNode) {
                        if (jmlParent.hasFeature && jmlParent.hasFeature(__WITH_JMLDOM__))
                            o.$setParent(jmlParent);
                        else {
                            o.parentNode = jmlParent;
                            jmlParent.childNodes.push(o);
                        }
                    }

                    return o;
                }

                // #ifdef __DEBUG
                jpf.console.info("Processing '" + tagName + "' node");
                // #endif

                o = this.handler[tagName](x, (noImpliedParent
                    ? null
                    : jmlParent), pHtmlNode);

                name = x.getAttribute("id"); //or u could use o.name

                //Add this component to the nameserver
                if (o && name)
                    jpf.nameserver.register(tagName, name, o);

                //#ifdef __WITH_JMLDOM_FULL
                if (!o || !o.nodeType)
                    o = new jpf.JmlDom(tagName, jmlParent, jpf.NODE_HIDDEN, x, o);
                else if(noImpliedParent)
                    o.$setParent(jmlParent);
                //#endif

                o.$jmlLoaded = true;

                if (name)
                    jpf.setReference(name, o);
            }

            //XForms
            //#ifdef __WITH_XFORMS
            else if (jmlParent && (jmlParent.hasFeature(__XFORMS__)
              && (this.xforms[tagName] || jmlParent.setCaption
              && this.xforms[tagName] > 2))) {
                switch (this.xforms[tagName]) {
                    case 1: //Set Event
                        if (x.getAttribute("ev:event")) {
                            jmlParent.dispatchEvent(x.getAttribute("ev:event"),
                                function(){
                                    this.executeXFormStack(x);
                                });
                        }
                        else
                            jmlParent.executeXFormStack(x);
                        break;
                    case 2: //Parse in Element
                        jmlParent.parseXFormTag(x);
                        break;
                    case 3: //Label
                        if (jmlParent.setCaption) {
                            jmlParent.setCaption(x.firstChild.nodeValue); //or replace it or something...
                            break;
                        }

                        //Create element using this function
                        var oLabel = this.nsHandler[jpf.ns.jml].call(this, x,
                            jmlParent.oExt.parentNode, jmlParent.parentNode);

                        //Set Dom stuff
                        oLabel.parentNode = jmlParent.parentNode;
                        for (var i = 0; i < jmlParent.parentNode.childNodes.length; i++) {
                            if (jmlParent.parentNode.childNodes[i] == jmlParent) {
                                jmlParent.parentNode.childNodes[i] = oLabel;
                            }
                            else if (jmlParent.parentNode.childNodes[i] == oLabel) {
                                jmlParent.parentNode.childNodes[i] = jmlParent;
                                break;
                            }
                        }

                        //Insert element to parentHtmlNode of jmlParent and before the node
                        oLabel.oExt.parentNode.insertBefore(oLabel.oExt, jmlParent.oExt);

                        //Use for
                        oLabel.setFor(jmlParent);
                        break;
                }
            }
            //#endif
            //JML Components
            else if (pHtmlNode) {
                // #ifdef __DEBUG
                if (!jpf[tagName] || typeof jpf[tagName] != "function")
                    throw new Error(jpf.formatErrorString(1017, null,
                        "Initialization",
                        "Could not find Class Definition '" + tagName + "'.", x));
                // #endif

                if (!jpf[tagName])
                    throw new Error("Could not find class " + tagName);

                var objName = tagName;

                //Check if Class is loaded in current Window
                //if(!self[tagName]) main.window.jpf.importClass(main.window[tagName], false, window);

                //#ifdef __WITH_XFORMS
                if (tagName == "select1" && x.getAttribute("appearance") == "minimal") {
                    objName = "dropdown";
                }
                //#endif
                // #ifdef __WITH_HTML5
                if (tagName == "input") {
                    objName = jpf.HTML5INPUT[objName = x.getAttribute("type")]
                        || objName || "textbox";
                }
                //#endif

                //Create Object en Reference
                var o = new jpf[objName](pHtmlNode, tagName, x);
                if (x.getAttribute("id"))
                    jpf.setReference(x.getAttribute("id"), o);

                //Process JML
                if (o.loadJml)
                    o.loadJml(x, jmlParent);

                o.$jmlLoaded = true;
            }

            return o;
        }

        //#ifdef __WITH_XSD
        //XML Schema Definition
        ,"http://www.w3.org/2001/XMLSchema" : function(x, pHtmlNode, jmlParent, noImpliedParent){
            var type = jpf.XSDParser.parse(x);
            if (type && jmlParent)
                jmlParent.setProperty("datatype", type);
        }
        //#endif

        // #ifdef __WITH_HTML_PARSING
        //XHTML
        ,"http://www.w3.org/1999/xhtml" :  function(x, pHtmlNode, jmlParent, noImpliedParent){
            var parseWhole = x.tagName.match(/table|object|embed/i) ? true : false;

            //#ifdef __DEBUG
            if (!pHtmlNode) {
                throw new Error(jpf.formatErrorString(0, jmlParent,
                    "Parsing html elements",
                    "Unexpected HTML found", x));
            }
            //#endif

            // Move all this to the respective browser libs in a wrapper function
            if (x.tagName == "script") {
                return;
            }
            else if (x.tagName == "option") {
                var o = pHtmlNode.appendChild(pHtmlNode.ownerDocument.createElement("option"));
                if (x.getAttribute("value"))
                    o.setAttribute("value", x.getAttribute("value"));
            }
            else if (jpf.isIE) {
                var o = (x.ownerDocument == pHtmlNode.ownerDocument)
                    ? pHtmlNode.appendChild(x.cloneNode(false))
                    : jpf.xmldb.htmlImport(x.cloneNode(parseWhole), pHtmlNode);
            }
            else if (jpf.isSafari) { //SAFARI importing cloned node kills safari.. temp workaround in place
                //o = pHtmlNode.appendChild(pHtmlNode.ownerDocument.importNode(x));//.cloneNode(false)
                var o = (x.ownerDocument == pHtmlNode.ownerDocument)
                    ? pHtmlNode.appendChild(x)
                    : jpf.xmldb.htmlImport(x.cloneNode(parseWhole), pHtmlNode);
            }
            else {
                var o = (x.ownerDocument == pHtmlNode.ownerDocument)
                    ? pHtmlNode.appendChild(x.cloneNode(false))
                    : jpf.xmldb.htmlImport(x.cloneNode(false), pHtmlNode);
                //o = pHtmlNode.appendChild(pHtmlNode.ownerDocument.importNode(x.cloneNode(false), false));
            }

            //Check attributes for j:left etc and j:repeat-nodeset
            var tagName;
            var prefix = this.lastNsPrefix || jpf.findPrefix(x.parentNode, jpf.ns.jml) || "";
            if (prefix && !x.style) {
                if (!jpf.supportNamespaces)
                    x.ownerDocument.setProperty("SelectionNamespaces", "xmlns:"
                        + prefix + "='" + jpf.ns.jml + "'");
                prefix += ":";
            }

            //#ifdef __WITH_XFORMS || __WITH_HTML_POSITIONING
            var done = {}, aNodes = !x.style && x.selectNodes("@" + prefix + "*") || [];
            for (var i = 0; i < aNodes.length; i++) {
                tagName = aNodes[i][jpf.TAGNAME];

                //#ifdef __WITH_HTML_POSITIONING
                //@todo rewrite this, and optimize html loading
                if (tagName.match(/^(left|top|right|bottom|width|height|align)$/)) {
                    if (done["position"]) continue;
                    done["position"] = true;
                    //Create positioning object - remove attributes when done
                    var html = new jpf.HtmlWrapper(pHtmlNode, o, prefix);

                    if (x.getAttribute(prefix + "align")
                      || x.getAttribute(prefix + "align-position")) {
                        html.enableAlignment()
                    }
                    else if (x.getAttribute(prefix + "width")
                      || x.getAttribute(prefix + "height")
                      || x.getAttribute(prefix + "left")
                      || x.getAttribute(prefix + "top")
                      || x.getAttribute(prefix + "right")
                      || x.getAttribute(prefix + "bottom")
                      || x.getAttribute(prefix + "anchoring") == "true") {
                        html.getDiff();
                        html.setHorizontal(x.getAttribute(prefix + "left"),
                            x.getAttribute(prefix + "right"),
                            x.getAttribute(prefix + "width"));
                        html.setVertical(x.getAttribute(prefix + "top"),
                            x.getAttribute(prefix + "bottom"),
                            x.getAttribute(prefix + "height"));
                    }

                    //return o;
                }
                //#endif

                //#ifdef __WITH_XFORMS
                /* XForms support
                    - repeat-model
                    - repeat-bind
                    - repeat-nodeset
                    - repeat-startindex
                    - repeat-number
                */
                else if (tagName.match(/^repeat-/)) {
                    if (done["repeat"]) continue;
                    done["repeat"] = true;
                    //Create repeat object - remove attributes when done

                }
                //#endif
            }
             //#endif

            if ((jpf.canUseInnerHtmlWithTables || !parseWhole) && x.tagName.toUpperCase() != "IFRAME")
                this.parseChildren(x, o, jmlParent);
            else {
                //#ifdef __DEBUG
                jpf.console.warn("Not parsing children of table, \
                    ignoring all Javeline Platform Elements.");
                //#endif
            }

            // #ifdef __WITH_EDITMODE || __WITH_LANG_SUPPORT
            if (jpf.xmldb.getTextNode(x)) {
                var data = {
                    jmlNode  : x,
                    htmlNode : o
                }

                /* #ifdef __WITH_EDITMODE
                EditServer.register(data);
                #endif */
                // #ifdef __WITH_LANG_SUPPORT
                jpf.language.addElement(jpf.xmldb.getTextNode(x)
                    .nodeValue.replace(/^\$(.*)\$$/, "$1"), data);
                // #endif
            }
            // #endif

            return o;
        }
        // #endif
    },

    //#ifdef __WITH_XFORMS
    xforms : {
        "label"       : 3, //any non-has-children node

        "action"      : 1, //stacked processing
        "dispatch"    : 1,
        "rebuild"     : 1,
        "recalculate" : 1,
        "revalidate"  : 1,
        "refresh"     : 1,
        "setfocus"    : 1,
        "load"        : 1,
        "setvalue"    : 1,
        "send"        : 1,
        "reset"       : 1,
        "message"     : 1,
        "insert"      : 1,
        "delete"      : 1,

        "filename"    : 2, //widget specific processing
        "mediatype"   : 2,
        "itemset"     : 2,
        "item"        : 2,
        "choices"     : 2,
        "copy"        : 2,
        "help"        : 2,
        "hint"        : 2
    },
    //#endif

    //#endif

    invalidJml : function(jml, message){
        //#ifdef __DEBUG
        jpf.console.warn((message || "Invalid JML syntax. The j:"
                        + jml[jpf.TAGNAME] + " node should not be placed under \
                         it's current parent:") + "\n"
                        + (jml.xml || jml.serialize));
        //#endif
    },

    handler : {
        /**
         * @define script element that loads javascript into the application
         * either from it's first child or from a file.
         * Example:
         * <code>
         *  <j:script src="code.js" />
         * </code>
         * Example:
         * <code>
         *  <j:script><![CDATA[
         *      for (var i = 0; i < 10; i++) {
         *          alert(i);
         *      }
         *  ]]></j:script>
         * </code>
         * @attribute {String} src the location of the script file.
         * @addnode global, anyjml
         */
        "script" : function(q){
            if (q.getAttribute("src")) {
                if (jpf.isOpera) {
                    setTimeout(function(){
                        jpf.window.loadCodeFile(jpf.hostPath
                            + q.getAttribute("src"));
                    }, 1000);
                }
                else {
                    jpf.window.loadCodeFile(jpf.hostPath
                        + q.getAttribute("src"));
                }
            }
            else if (q.firstChild) {
                var scode = q.firstChild.nodeValue;
                jpf.exec(scode);
            }
        },

        //#ifdef __WITH_STATE
        /**
         * @define state-group element that groups state elements together and
         * provides a way to set a default state.
         *  <j:state-group
         *    loginMsg.visible  = "false"
         *    winLogin.disabled = "false">
         *      <j:state id="stFail"
         *          loginMsg.value   = "Username or password incorrect"
         *          loginMsg.visible = "true" />
         *      <j:state id="stError"
         *          loginMsg.value   = "An error has occurred. Please check your network."
         *          loginMsg.visible = "true" />
         *      <j:state id="stLoggingIn"
         *          loginMsg.value    = "Please wait while logging in..."
         *          loginMsg.visible  = "true"
         *          winLogin.disabled = "true" />
         *      <j:state id="stIdle" />
         *  </j:state-group>
         * @addnode elements
         * @see state
         */
        "state-group" : function(q, jmlParent){
            var name = q.getAttribute("name") || "stategroup" + jpf.all.length;
            var pState = jpf.StateServer.addGroup(name, null, jmlParent);

            var nodes = q.childNodes, attr = q.attributes, al = attr.length;
            for (var j, i = 0, l = nodes.length; i < l; i++){
                var node = nodes[i];

                if (node.nodeType != 1 || node[jpf.TAGNAME] != "state")
                    continue;

                for (j = 0; j < al; j++) {
                    if (!node.getAttribute(attr[j].nodeName))
                        node.setAttribute(attr[j].nodeName, attr[j].nodeValue);
                }

                node.setAttribute("group", name);

                //Create Object en Reference and load JML
                new jpf.state(jmlParent ? jmlParent.pHtmlNode : document.body, "state", node)
                    .loadJml(node, pState);
            }

            return pState;
        },
        //#endif

        //#ifdef __WITH_ICONMAP
        /**
         * @define iconmap element that provides a means to get icons from a
         * single image containing many icons.
         * Example:
         * <code>
         *  <j:iconmap id="tbicons" src="toolbar.icons.gif"
         *    type="horizontal" size="20" offset="2,2" />
         *
         *  <j:menu id="mmain" skin="menu2005">
         *      <j:item icon="tbicons:1">Copy</j:item>
         *      <j:item icon="tbicons:2">Cut</j:item>
         *  </j:menu>
         * </code>
         * @attribute {String} src    the location of the image.
         * @attribute {String} type   the spatial distribution of the icons within the image.
         *   Possible values:
         *   horizontal the icons are horizontally tiled.
         *   vertically the icons are vertically tiled.
         * @attribute {String} size   the width and height in pixels of an icon. Use this for square icons.
         * @attribute {String} width  the width of an icon in pixels.
         * @attribute {String} height the height of an icon in pixels.
         * @attribute {String} offset the distance from the calculated grid point that has to be added. This value consists of two numbers seperated by a comma. Defaults to 0,0.
         * @addnode elements
         */
        "iconmap" : function(q, jmlParent){
            var name = q.getAttribute("id");

            //#ifdef __DEBUG
            if (!name) {
                throw new Error(jpf.formatErrorString(0, null,
                    "Creating icon map",
                    "Could not create iconmap. Missing id attribute", q));
            }
            //#endif

            return jpf.skins.addIconMap({
                name   : name,
                src    : q.getAttribute("src"),
                type   : q.getAttribute("type"),
                size   : parseInt(q.getAttribute("size")),
                width  : parseInt(q.getAttribute("width")),
                height : parseInt(q.getAttribute("height")),
                offset : (q.getAttribute("offset") || "0,0").splitSafe(",")
            });
        },
        //#endif

        //#ifdef __JWINDOW
        /**
         * See {@link modalwindow}
         */
        "window" : function(q, jmlParent, pHtmlNode){
            //Create Object en Reference
            var o = new jpf.modalwindow(pHtmlNode, "window", q);

            //Process JML
            o.loadJml(q, jmlParent);

            //jpf.windowManager.addForm(q); //@todo rearchitect this

            return o;
        },
        //#endif

        //#ifdef __WITH_PRESENTATION
        /**
         * @define style element containing css
         * @addnode global, anyjml
         */
        "style" : function(q){
            jpf.importCssString(document, q.firstChild.nodeValue);
        },

        /**
         * @define comment all elements within the comment tag are ignored by the parser.
         * @addnode anyjml
         */
        "comment" : function (q){
            //do nothing
        },

        /**
         * @define presentation element containing a skin definition
         * @addnode global, anyjml
         */
        "presentation" : function(q){
            var name = "skin" + Math.round(Math.random() * 100000);
            q.parentNode.setAttribute("skin", name);
            jpf.skins.skins[name] = {name:name,templates:{}}
            var t    = q.parentNode[jpf.TAGNAME];
            var skin = q.ownerDocument.createElement("skin"); skin.appendChild(q);
            jpf.skins.skins[name].templates[t] = skin;
        },

        /**
         * @define skin element specifying the skin of an application.
         * Example:
         * <code>
         *  <j:skin src="perspex.xml"
         *    name       = "perspex"
         *    media-path = "http://example.com/images"
         *    icon-path  = "http://icons.example.com" />
         * </code>
         * @attribute {String} name       the name of the skinset.
         * @attribute {String} src        the location of the skin definition.
         * @attribute {String} media-path the basepath for the images of the skin.
         * @attribute {String} icon-path  the basepath for the icons used in the elements using this skinset.
         * @addnode global, anyjml
         */
        "skin" : function(q, jmlParent){
            if (jmlParent) {
                var name = "skin" + Math.round(Math.random() * 100000);
                q.parentNode.setAttribute("skin", name);
                jpf.skins.skins[name] = {name: name, templates: {}};
                jpf.skins.skins[name].templates[q.parentNode[jpf.TAGNAME]] = q;
            }
            else if (q.childNodes.length) {
                jpf.skins.Init(q);
            }
            else {
                var path = q.getAttribute("src")
                    ? jpf.getAbsolutePath(jpf.hostPath, q.getAttribute("src"))
                    : jpf.getAbsolutePath(jpf.hostPath, q.getAttribute("name")) + "/index.xml";

                jpf.loadJmlInclude(q, true, path);
            }
        },
        //#endif

        //#ifdef __WITH_DATABINDING || __WITH_XFORMS

        "model" : function(q, jmlParent){
            var model = new jpf.model().loadJml(q, jmlParent);

            if (jmlParent && jmlParent.hasFeature(__DATABINDING__)) {
                modelId = "model" + jmlParent.uniqueId;
                jmlParent.$jml.setAttribute("model", modelId);
                model.register(jmlParent);
                jpf.nameserver.register("model", modelId, model);
            }

            return model;
        },

        //#ifdef __WITH_SMARTBINDINGS
        "smartbinding" : function(q, jmlParent){
            var bc = new jpf.smartbinding(q.getAttribute("id"), q, jmlParent);

            if (jmlParent && jmlParent.hasFeature(__DATABINDING__))
                jpf.JmlParser.addToSbStack(jmlParent.uniqueId, bc);

            return bc;
        },

        "ref" : function(q, jmlParent){
            if (!jmlParent || !jmlParent.hasFeature(__DATABINDING__))
                return jpf.JmlParser.invalidJml(q);

            jpf.JmlParser.getFromSbStack(jmlParent.uniqueId)
                .addBindRule(q, jmlParent);
        }, //not referencable

        "bindings" : function(q, jmlParent){
            var rules = jpf.getRules(q);

            if (jmlParent && jmlParent.hasFeature(__DATABINDING__))
                jpf.JmlParser.getFromSbStack(jmlParent.uniqueId)
                    .addBindings(rules, q);

            return rules;
        },

        "action" : function(q, jmlParent){
            if (!jmlParent || !jmlParent.hasFeature(__DATABINDING__))
                return jpf.JmlParser.invalidJml(q);

            jpf.JmlParser.getFromSbStack(jmlParent.uniqueId)
                .addActionRule(q, jmlParent);
        }, //not referencable

        "actions" : function(q, jmlParent){
            var rules = jpf.getRules(q);

            if (jmlParent && jmlParent.hasFeature(__DATABINDING__)) {
                jpf.JmlParser.getFromSbStack(jmlParent.uniqueId)
                    .addActions(rules, q);
            }

            return rules;
        },

        // #endif
        // #endif

        // #ifdef __WITH_ACTIONTRACKER
        "actiontracker" : function(q, jmlParent){
            var at = new jpf.actiontracker(jmlParent);
            at.loadJml(q);
            
            if (jmlParent)
                jmlParent.$at = at;

            return at;
        },
        //#endif

        // #ifdef __WITH_CONTEXTMENU

        /**
         * @for JmlNode
         * @define contextmenu element specifying which menu is shown when a
         * contextmenu is requested by a user for a jml node.
         * Example:
         * This example shows a list that shows the mnuRoot menu when the user
         * right clicks on the root data element. Otherwise the mnuItem menu is
         * shown.
         * <code>
         *  <j:list>
         *      <j:contextmenu menu="mnuRoot" select="root" />
         *      <j:contextmenu menu="mnuItem" />
         *  </j:list>
         * </code>
         * @attribute {String} menu   the id of the menu element.
         * @attribute {String} select the xpath executed on the selected element of the databound element which determines whether this contextmenu is shown.
         */
        "contextmenu" : function(q, jmlParent){
            if (!jmlParent)
                return jpf.JmlParser.invalidJml(q); //not supported

            if (!jmlParent.contextmenus)
                jmlParent.contextmenus = [];
            jmlParent.contextmenus.push(q);
        },

        //#endif

        // #ifdef __WITH_DRAGDROP
        "allow-drag" : function(q, jmlParent){
            if (!jmlParent || !jmlParent.hasFeature(__DATABINDING__))
                return jpf.JmlParser.invalidJml(q);

            jpf.JmlParser.getFromSbStack(jmlParent.uniqueId)
                .addDragRule(q, jmlParent);
        },  //not referencable

        "allow-drop" : function(q, jmlParent){
            if (!jmlParent || !jmlParent.hasFeature(__DATABINDING__))
                return jpf.JmlParser.invalidJml(q);

            jpf.JmlParser.getFromSbStack(jmlParent.uniqueId)
                .addDropRule(q, jmlParent);
        },  //not referencable

        "dragdrop" : function(q, jmlParent){
            var rules = jpf.getRules(q);

            if (jmlParent && jmlParent.hasFeature(__DATABINDING__)) {
                jpf.JmlParser.getFromSbStack(jmlParent.uniqueId)
                    .addDragDrop(rules, q);
            }

            return rules;
        },
        // #endif

        // #ifdef __WITH_TELEPORT
        "teleport" : function(q, jmlParent){
            //Initialize Communication Component
            return jpf.teleport.loadJml(q, jmlParent);
        },
        // #endif

        // #ifdef __WITH_RSB
        "remote" : function(q, jmlParent){
            //Remote Smart Bindings
            return new jpf.remote(q.getAttribute("id"), q, jmlParent);
        },
        // #endif

        "appsettings" : function(q, jmlParent){
            return jpf.appsettings.loadJml(q, jmlParent);
        }

        //#ifdef __DESKRUN
        , "deskrun" : function(q){
            if (!jpf.isDeskrun) return;
            jpf.window.loadJml(q); //@todo rearchitect this
        }
        //#endif

        /**
         * @define loader Element defining the html that is shown while the
         * application is loading.
         * Example:
         * <code>
         *  <j:loader>
         *      <div class="loader">
         *          Loading...
         *      </div>
         *  </j:loader>
         * </code>
         * @addnode global
         */
        , "loader" : function(q){
            //ignore, handled elsewhere
        }
    },

    // #ifdef __WITH_SMARTBINDINGS
    getSmartBinding : function(id){
        return jpf.nameserver.get("smartbinding", id);
    },
    // #endif

    // #ifdef __WITH_ACTIONTRACKER
    getActionTracker : function(id){
        var at = jpf.nameserver.get("actiontracker", id);
        if (at)
            return at;
        if (self[id])
            return self[id].getActionTracker();
    },
    // #endif

    // #ifdef __WITH_PRESENTATION
    replaceNode : function(newNode, oldNode){
        var nodes = oldNode.childNodes;
        for (var i = nodes.length - 1; i >= 0; i--) {
            if (nodes[i].host) {
                nodes[i].host.pHtmlNode = newNode;
            }
            newNode.insertBefore(nodes[i], newNode.firstChild);
        }

        newNode.onresize = oldNode.onresize;

        return newNode;
    },
    // #endif

    parseLastPass : function(){
        /* #ifdef __WITH_EDITMODE
        return;
        #endif */

        //#ifdef __DEBUG
        jpf.console.info("Parse final pass");
        //#endif

        //#ifdef __WITH_OFFLINE //@todo remove this
        //if (!jpf.appsettings.offline)
        //   jpf.offline.init();
        //#endif

        jpf.parsingFinalPass = true;

        /*
            All these component dependant things might
            be suited better to be in a component generation
            called event
        */

        //#ifdef __WITH_DATABINDING || __WITH_XFORMS || __WITH_SMARTBINDINGS
        while (this.hasNewSbStackItems) {
            var sbInit              = this.sbInit;
            this.sbInit             = {};
            this.hasNewSbStackItems = false;

            //Initialize Databinding for all GUI Elements in Form
            for (var uniqueId in sbInit) {
                if (parseInt(uniqueId) != uniqueId)
                    continue;

                //Retrieve Jml Node
                var jNode = jpf.lookup(uniqueId);

                //Set Main smartbinding
                if (sbInit[uniqueId][0]) {
                    jNode.$propHandlers["smartbinding"]
                        .call(jNode, sbInit[uniqueId][0], true);
                }

                //Set selection smartbinding if any
                if (sbInit[uniqueId][1])
                    jNode.$setMultiBind(sbInit[uniqueId][1]);
            }
        }
        this.sbInit = {};
        //#endif

        //#ifdef __WITH_STATE || __WITH_PROPERTY_BINDING
        //Initialize property bindings
        var s = this.stateStack;
        for (var i = 0; i < s.length; i++) {
            //if (s[i].name == "visible" && !/^\{.*\}$/.test(s[i].value)) //!jpf.dynPropMatch.test(pValue)
                //continue; //@todo check that this code can be removed...
            s[i].node.setDynamicProperty(s[i].name, s[i].value);
        }
        this.stateStack = [];
        //#endif

        //#ifdef __WITH_MODEL || __WITH_XFORMS
        //Initialize Models
        while (this.hasNewModelStackItems) {
            var jmlNode, modelInit     = this.modelInit;
            this.modelInit             = {};
            this.hasNewModelStackItems = false;

            for (var data,i = 0; i < modelInit.length; i++) {
                data    = modelInit[i][1];
                data[0] = data[0].substr(1);

                jmlNode = eval(data[0]);
                if (jmlNode.connect)
                    jmlNode.connect(modelInit[i][0], null, data[2], data[1] || "select");
                else
                    jmlNode.setModel(new jpf.model().loadFrom(data.join(":")));
            }
        }
        this.modelInit = [];
        //#endif

        //Call the onload event
        if (!jpf.loaded)
            jpf.dispatchEvent("load");
        jpf.loaded = true;

        //#ifdef __WITH_XFORMS
        var models = jpf.nameserver.getAll("model");
        for (var i = 0; i < models.length; i++)
            models[i].dispatchEvent("xforms-ready");
        //#endif

        // #ifdef __WITH_ANCHORING || __WITH_ALIGNMENT || __WITH_GRID
        jpf.layout.activateRules();// processQueue();
        //#endif

        if (!this.loaded) {
            //#ifdef __DESKRUN
            if (jpf.isDeskrun)
                jpf.window.deskrun.Show();
            //#endif

            //Set the default selected element
            jpf.window.focusDefault();

            this.loaded = true;
        }

        //END OF ENTIRE APPLICATION STARTUP

        //#ifdef __DEBUG
        jpf.console.info("Initialization finished");
        //#endif

        //#ifdef __DEBUG
        jpf.Latometer.end();
        jpf.Latometer.addPoint("Total time for final pass");
        //#endif

        jpf.isParsing = false;
        jpf.parsingFinalPass = false;
    }

    // #ifdef __WITH_DATABINDING || __WITH_XFORMS || __WITH_SMARTBINDINGS
    ,
    addToSbStack : function(uniqueId, sNode, nr){
        this.hasNewSbStackItems = true;

        return ((this.sbInit[uniqueId]
            || (this.sbInit[uniqueId] = []))[nr||0] = sNode);
    },

    getFromSbStack : function(uniqueId, nr, create){
        this.hasNewSbStackItems = true;
        if (nr) {
            if (!create)
                return (this.sbInit[uniqueId] || {})[nr];

            return this.sbInit[uniqueId]
                && (this.sbInit[uniqueId][nr]
                    || (this.sbInit[uniqueId][nr] = new jpf.smartbinding()))
                || ((this.sbInit[uniqueId] = [])[nr] = new jpf.smartbinding());
        }

        return !this.sbInit[uniqueId]
            && (this.sbInit[uniqueId] = [new jpf.smartbinding()])[0]
            || this.sbInit[uniqueId][0]
            || (this.sbInit[uniqueId][0] = new jpf.smartbinding());
    },

    stackHasBindings : function(uniqueId){
        return (this.sbInit[uniqueId] && this.sbInit[uniqueId][0]
          && this.sbInit[uniqueId][0].bindings);
    }
    // #endif

    // #ifdef __WITH_MODEL
    ,

    addToModelStack : function(o, data){
        this.hasNewModelStackItems = true;
        this.modelInit.push([o, data]);
    }
    // #endif
};

//#ifdef __WITH_HTML5
/**
 * @define input
 * Remarks:
 * Javeline PlatForm supports the input types specified by the WHATWG html5 spec.
 * @attribute {String} type the type of input element.
 *   Possible values:
 *   email      provides a way to enter an email address.
 *   url        provides a way to enter a url.
 *   password   provides a way to enter a password.
 *   datetime   provides a way to pick a date and time.
 *   date       provides a way to pick a date.
 *   month      provides a way to pick a month.
 *   week       provides a way to pick a week.
 *   time       provides a way to pick a time.
 *   number     provides a way to pick a number.
 *   range      provides a way to select a point in a range.
 *   checkbox   provides a way to set a boolean value.
 *   radio      used in a set, it provides a way to select a single value from multiple options.
 *   file       provides a way to upload a file.
 *   submit     provides a way to submit data.
 *   image      provides a way to submit data displaying an image instead of a button.
 *   reset      provides a way to reset entered data.
 * @addnode elements
 */
/**
 * @private
 */
jpf.HTML5INPUT = {
    "email"    : "textbox",
    "url"      : "textbox",
    "password" : "textbox",
    "datetime" : "spinner", //@todo
    "date"     : "calendar",
    "month"    : "spinner", //@todo
    "week"     : "spinner", //@todo
    "time"     : "spinner", //@todo
    "number"   : "spinner",
    "range"    : "slider",
    "checkbox" : "checkbox",
    "radio"    : "radiobutton",
    "file"     : "fileuploadbox",
    "submit"   : "submit",
    "image"    : "submit",
    "reset"    : "button"
};

//#endif

jpf.Init.run('jpf.JmlParser');
