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
// #ifdef __AMLUPLOAD || __INC_ALL

/**
 * Element allowing the user to upload a file to a server. This element does 
 * not have a visual representation. By adding buttons, a progressbar and other
 * elements you can fully customize your upload component. Use
 * {@link term.propertybinding property binding} to update those elements with
 * the state of the upload element.
 * 
 * Example:
 * This example shows an upload element that pushes an image to the server. The
 * asp script returns an xml string which is added to the list of images on a
 * successfull upload.
 * <code>
 *  <a:list id="lstImages" smartbinding="..." model="..." />
 *
 *  <a:upload id="uplMain"
 *    target    = "../api/UploadPicture.asp"
 *    ontimeout = "alert('It seems the server went away')"
 *    oncancel  = "alert('Could not upload logo')"
 *    onuploaded = "lstImages.add(arguments[0])" />
 *
 *  <a:button caption="Browse file..." onclick="uplMain.browse()" 
 *    disabled="{uplMain.uploading}" />
 *  <a:button caption="{uplMain.uploading ? 'Cancel' : 'Send'}" 
 *    disabled="{!uplMain.value}" onclick="
 *      if (uplMain.uploading)
 *          uplMain.cancel();
 *      else
 *          uplMain.upload();
 *    " />
 * </code>
 *
 * @event afterbrowse Fires after the user has made a selection.
 *   object:
 *   {String} value the path of the file selected
 *
 * @constructor
 * @alias upload
 * @addnode elements
 *
 * @inherits apf.StandardBinding
 *
 * @author      Mike de Boer (mike AT ajax DOT org)
 * @version     %I%, %G%
 * @since       3.0
 *
 * @binding value  Determines the way the value for the element is retrieved 
 * from the bound data.
 * Example:
 * Sets the value based on data loaded into this component.
 * <code>
 *  <a:upload value="[@filename]" />
 * </code>
 *
 * @todo get server side information to update the progressbar.
 */
apf.upload = function(struct, tagName){
    this.$init(tagName || "upload", apf.NODE_VISIBLE, struct);

    var o,
        i = 0,
        a = ["html5", "flash", "html4"];
    for (; i < 4 && !this.$method; ++i) {
        o = apf.upload[a[i]];
        if (typeof o != "undefined" && o.isSupported())
            this.$method = new o(this);
    }

    if (!this.$method) {
        throw new Error(apf.formatErrorString(0, this, "upload",
            "No upload method found that us supported by your browser!"));
    }
};

(function(constants){
    this.implement(
        //#ifdef __WITH_DATAACTION
        apf.DataAction
        //#endif
    );

    this.state        = constants.STOPPED;
    this.chunksize    = 0;
    this.maxfilesize  = 1073741824; //"1gb"
    this.multiselect  = true;
    this.multipart    = true;
    this.filedataname = "Filedata";

    this.$method      = null;
    this.$filter      = [];

    this.$booleanProperties["multiselect"] = true;
    this.$booleanProperties["multipart"]   = true;

    this.$supportedProperties.push("state", "total", "chunksize", "maxfilesize",
        "multiselect", "filedataname", "target", "filter", "multipart", "size",
        "loaded", "percent", "bitrate", "uploaded", "failed", "queued", "button",
        "model");

    var startTime, fileIndex;
    this.$propHandlers["state"] = function(value) {
        // Get start time to calculate bps
        if (this.state & constants.STARTED)
            startTime = (+new Date());
    };

    this.$propHandlers["total"] = function(value) {
        //todo
    };

    this.$propHandlers["chunksize"] = function(value) {
        this.chunksize = parseSize(value);
    };

    this.$propHandlers["maxfilesize"] = function(value) {
        this.chunksize = parseSize(value);
    };

    this.$propHandlers["filter"] = function(value) {
        this.$filter = value.splitSafe(",");
    };

    this.$propHandlers["button"] = function(value) {
        this.$button = self[value];

        // #ifdef __DEBUG
        if (!this.$button || !this.$button.$ext) {
            throw new Error(apf.formatErrorString(0, this, "upload init",
                "No valid identifier for a Button element passed to the 'button' attribute."));
        }
        //#endif
    };

    this.$propHandlers["model"] = function(value) {
        this.$files = new constants.files(this, value);
    };

    this.$mimeTypes = {
        "doc"  : "application/msword",
        "dot"  : "application/msword",
        "pdf"  : "application/pdf",
        "pgp"  : "application/pgp-signature",
        "ps"   : "application/postscript",
        "ai"   : "application/postscript",
        "eps"  : "application/postscript",
        "rtf"  : "text/rtf",
        "xls"  : "application/vnd.ms-excel",
        "xlb"  : "application/vnd.ms-excel",
        "ppt"  : "application/vnd.ms-powerpoint",
        "pps"  : "application/vnd.ms-powerpoint",
        "pot"  : "application/vnd.ms-powerpoint",
        "zip"  : "application/zip",
        "swf"  : "application/x-shockwave-flash",
        "swfl" : "application/x-shockwave-flash",
        "docx" : "application/vnd.openxmlformats",
        "pptx" : "application/vnd.openxmlformats",
        "xlsx" : "application/vnd.openxmlformats",
        "mpga" : "audio/mpeg",
        "mpega": "audio/mpeg",
        "mp2"  : "audio/mpeg",
        "mp3"  : "audio/mpeg",
        "wav"  : "audio/x-wav",
        "bmp"  : "image/bmp",
        "gif"  : "image/gif",
        "jpeg" : "image/jpeg",
        "jpg"  : "image/jpeg",
        "jpe"  : "image/jpeg",
        "png"  : "image/png",
        "svg"  : "image/svg+xml",
        "svgz" : "image/svg+xml",
        "tiff" : "image/tiff",
        "tif"  : "image/tiff",
        "htm"  : "text/html",
        "html" : "text/html",
        "xhtml": "text/html",
        "mpeg" : "video/mpeg",
        "mpg"  : "video/mpeg",
        "mpe"  : "video/mpeg",
        "qt"   : "video/quicktime",
        "mov"  : "video/quicktime",
        "flv"  : "video/x-flv",
        "rv"   : "video/vnd.rn-realvideo",
        "asc"  : "text/plain",
        "txt"  : "text/plain",
        "text" : "text/plain",
        "diff" : "text/plain",
        "log"  : "text/plain",
        "exe"  : "application/octet-stream"
    };

    function parseSize(size) {
        var mul;
        if (typeof size == "string") {
            size = /^([0-9]+)([mgk]+)$/.exec(size.toLowerCase().replace(/[^0-9mkg]/g, ""));
            mul  = size[2];
            size = +size[1];
            if (mul == "g")
                size *= 1073741824;
            if (mul == "m")
                size *= 1048576;
            if (mul == "k")
                size *= 1024;
        }

        return size;
    }

    function calc() {
        if (!this.$files) return;
        // Reset stats
        var file,
            size    = 0, loaded = 0, uploaded = 0, failed = 0, queued = 0,
            percent = 0, bitrate = 0,
            files   = this.$files.toArray(),
            i       = 0,
            l       = files.length;


        // Check status, size, loaded etc on all files
        for (; i < l; ++i) {
            file = files[i];

            if (typeof file.size != "undefined") {
                size   += file.size;
                loaded += file.loaded;
            }/* else {
                size = undef;
            }*/

            if (file.status & constants.DONE)
                uploaded++;
            else if (file.status & constants.FAILED)
                failed++;
            else
                queued++;
        }

        // If we couldn't calculate a total file size then use the number of files to calc percent
        if (size === 0) {
            percent = files.length > 0 ? Math.ceil(uploaded / files.length * 100) : 0;
        }
        else {
            bitrate = Math.ceil(loaded / ((+new Date() - startTime || 1) / 1000.0));
            percent = Math.ceil(loaded / size * 100);
        }

        this.setProperty("size",     size);
        this.setProperty("loaded",   loaded);
        this.setProperty("uploaded", uploaded);
        this.setProperty("failed",   uploaded);
        this.setProperty("queued",   queued);
        this.setProperty("percent",  percent);
        this.setProperty("bitrate",  bitrate);
    }

    function nextQueue() {
        var file,
            files = this.$files.toArray();
        if (this.state & constants.STARTED && fileIndex < files.length) {
            file = files[fileIndex++];
            if (file.status & constants.QUEUED)
                this.$method.upload(file);
            else
                nextQueue.call(this);
        }
        else {
			this.dispatchEvent("uploaded");
            this.stop();
        }
    }

    /**** Public methods ****/

    this.$buildUrl = function(url, items) {
        var query = "";
        for (var i in items)
            query += (query ? "&" : "") + encodeURIComponent(i) + "=" + encodeURIComponent(items[i]);
        if (query)
            url += (url.indexOf("?") > 0 ? "&" : "?") + query;
        return url;
    };

    this.$queue = function(selected_files) {
        var i, l, file, extensionsMap,
            count = 0;

        // Convert extensions to map
        if (l = this.$filter.length) {
            extensionsMap = {};
            for (i = 0; i < l; ++i)
                extensionsMap[this.$filter[i].toLowerCase()] = true;
        }

        if ((l = selected_files.length) > 1 && !this.multiple)
            selected_files = [selected_files[0]], l = 1;

        for (i = 0; i < l; ++i) {
            file = selected_files[i];
            file.loaded  = 0;
            file.percent = 0;
            file.status  = constants.QUEUED;

            // Invalid file extension
            if (extensionsMap && !extensionsMap[file.name.toLowerCase().split(".").slice(-1)]) {
                this.dispatchEvent("error", {
                    code    : constants.ERROR.FILE_EXTENSION_ERROR,
                    message : "File extension error.",
                    file    : file
                });
                continue;
            }

            // Invalid file size
            if (typeof file.size != "undefined" && file.size > this.maxfilesize) {
                this.dispatchEvent("error", {
                    code    : constants.ERROR_CODES.FILE_SIZE_ERROR,
                    message : "File size error.",
                    file    : file
                });
                continue;
            }

            // Add valid file to list
            this.$files.create(file);
            count++;
        }

		this.dispatchEvent("queue", {files: selected_files});

        // Only refresh if any files where added
        if (count) {
            calc.call(this);
            if (this.$method.refresh)
                this.$method.refresh();
        }
    };

    this.$progress = function(file) {
        if (file.status & constants.QUEUED)
            file.status = constants.UPLOADING;

        file.percent = file.size > 0 ? Math.ceil(file.loaded / file.size * 100) : 100;
        this.$files.update(file);
        calc.call(this);
    };

    this.$fileDone = function(file) {
        file.status = constants.DONE;
        this.$progress(file);
        nextQueue.call(this);
    };

    this.$fileRemove = function(file) {
        if (this.$method.removeFile)
            this.$method.removeFile(file);
        this.$files.remove(file);
        calc.call(this);
    };

    this.$draw = function(){
        if (this.$method.draw) {
            this.$ext = this.$getExternal("main");
            this.$method.draw();
        }
    };

    var states = {
        "buttonEnter": "Over",
        "buttonLeave": "Out",
        "buttonDown" : "Down"
    };

    this.$setButtonState = function(state) {
        if (!this.$button) return null; // @todo this will go when this class inherits from button

        if (state == "buttonDisabled")
            return this.$button.setProperty("disabled", true);
        else if (this.$button.disabled)
            this.$button.setProperty("disabled", false);

        return this.$button.$setState(states[state]);
    };

    this.start = function() {
        if (!(this.state & constants.STARTED)) {
            fileIndex = 0;
            this.setProperty("state", constants.STARTED);
            nextQueue.call(this);
        }
    };

    this.stop = function() {
       if (!(this.state & constants.STOPPED))
           this.setProperty("state", constants.STOPPED);
    };

    this.addEventListener("error", function(e) {
        // Set failed status if an error occured on a file
        if (e.file) {
            e.file.status = constants.FAILED;
            calc.call(this);

            // Upload next file but detach it from the error event
            // since other custom listeners might want to stop the queue
            var _self = this
            $setTimeout(function() {
                nextQueue.call(_self);
            });
        }
    });

    this.addEventListener("DOMNodeInsertedIntoDocument", function() {
        if (!this["model"])
            this.setProperty("model", "apfupload".appendRandomNumber(5));
        // #ifdef __DEBUG
        if (!this.$button) {
            throw new Error(apf.formatErrorString(0, this, "upload init",
                "Required: 'button' attribute not set, no button element available."));
        }
        if (!this.target) {
            throw new Error(apf.formatErrorString(0, this, "upload init",
                "Required: 'target' attribute not set, thus no valid uri to send files to."));
        }
        //#endif

        if (!this.$method) return;
        var _self = this;
        $setTimeout(function() {
            calc.call(_self);
            if (_self.$method.refresh)
                _self.$method.refresh();
        });
    });
// #ifdef __WITH_DATABINDING
}).call(apf.upload.prototype = new apf.StandardBinding(), apf.upload);
/* #else
}).call(apf.upload.prototype = new apf.Presentation(), apf.upload);
#endif*/

apf.upload.STOPPED   = 0x0001; // Inital state of the queue and also the state ones it's finished all it's uploads.
apf.upload.STARTED   = 0x0002; // Upload process is running
apf.upload.QUEUED    = 0x0004; // File is queued for upload
apf.upload.UPLOADING = 0x0008; // File is being uploaded
apf.upload.FAILED    = 0x0010; // File has failed to be uploaded
apf.upload.DONE      = 0x0020; // File has been uploaded successfully
// Error constants used by the Error event:
apf.upload.ERROR_CODES = {
    // Generic error for example if an exception is thrown inside Silverlight.
    GENERIC_ERROR        : -100,
    // HTTP transport error. For example if the server produces a HTTP status other than 200.
    HTTP_ERROR           : -200,
    // Generic I/O error. For exampe if it wasn't possible to open the file stream on local machine.
    IO_ERROR             : -300,
    // Generic I/O error. For exampe if it wasn't possible to open the file stream on local machine.
    SECURITY_ERROR       : -400,
    // Initialization error. Will be triggered if no runtime was initialized.
    INIT_ERROR           : -500,
    // File size error. If the user selects a file that is to large it will be
    // blocked and an error of this type will be triggered.
    FILE_SIZE_ERROR      : -600,
    // File extension error. If the user selects a file that isn't valid according
    // to the filters setting.
    FILE_EXTENSION_ERROR : -700
};

apf.upload.files = function(oUpload, model) {
    if (typeof model == "string") {
        var sModel = model;
        if (!(model = apf.nameserver.get(sModel))) {
            model = apf.setReference(sModel,
                apf.nameserver.register("model", sModel, new apf.model()));
            if (model === 0)
                model = self[sModel];
            else
                model.id = model.name = sModel;
        }
        // set the root node for this model
        model.load("<xmpp/>");
    }
    //#ifdef __DEBUG
    if (!model) {
        throw new Error(apf.formatErrorString(0, oUpload, "upload",
            "For the upload control to work, you MUST specify a valid value for the 'model' attribute!"));
    }
    //#endif

    model.load("<files/>");

    var oFiles = {},
        aFiles = [],
        userProps = {"addDate":1, "creationDate":1, "extension":1, "id":1,
                     "modificationDate":1, "name":1, "size":1, "status":1,
                     "validationError":1, "loaded":1
        };

    this.create = function(file) {
        if (!file || !file.id || oFiles[file.id]) return null;

        oFiles[file.id] = file;
        aFiles.pushUnique(file);
        if (model) {
            file.xml = model.data.ownerDocument.createElement("file");
            apf.xmldb.appendChild(model.data, file.xml);
        }

        return this.update(file);
    };

    this.createMany = function(arr) {
        if (!arr || !arr.length) return;

        for (var i = 0, l = arr.length; i < l; i++) {
            if (arr[i])
                this.create(arr[i]);
        }
    };

    this.read = function(filename) { };

    this.update = function(file) {
        if (!file || !file.id) return null;

        var i;
        if (!file.xml) {
            var t = file;
            file = oFiles[file.id];
            for (i in userProps)
                file[i] = t[i];
        }
        if (!model || !file.xml) return null;

        for (i in userProps) {
            if (typeof file[i] == "undefined") continue;
            if (i.indexOf("Date") != -1 && typeof file[i] == "number")
                file[i] = new Date(file[i]);

            file.xml.setAttribute(i, file[i]);
        }

        apf.xmldb.applyChanges("synchronize", file.xml);

        return file;
    };

    this.remove = function(file) {
        if (!file || !file.id || !oFiles[file.id]) return;

        file = oFiles[file.id];
        if (model && file.xml)
            apf.xmldb.removeChild(model.data, file.xml);
        aFiles.remove(file);
        delete oFiles[file.id];
    };

    this.removeMany = function(arr) {
        if (!arr || !arr.length) return;

        for (var i = 0, l = arr.length; i < l; i++) {
            if (arr[i])
                this.remove(arr[i]);
        }
    };

    this.get = function() {
        var l;
        if (l = arguments.length) {
            if (l === 1)
                return oFiles[arguments[0]];
            var res = {},
                i   = 0;
            for (; i < l; ++i) {
                if (oFiles[i])
                    res[oFiles[i].id] = oFiles[i];
            }
            return res;
        }
        return oFiles;
    };

    this.toArray = function() {
        return aFiles;
    };

    this.getValue = function() {
        var i,
            a = [];
        for (i in oFiles)
            a.push(oFiles[i].name);
        return a.join("|");
    };
};

apf.aml.setElement("upload", apf.upload);
// #endif
