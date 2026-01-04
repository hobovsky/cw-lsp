// ==UserScript==
// @name         LSP Integration for Codewars
// @namespace    lsp.cw.hobovsky
// @version      2026-01-05-001
// @author       hobovsky
// @updateURL    https://github.com/hobovsky/cw-lsp/raw/refs/heads/main/client/cw-lsp.user.js
// @downloadURL  https://github.com/hobovsky/cw-lsp/raw/refs/heads/main/client/cw-lsp.user.js
// @match        https://www.codewars.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant GM.xmlHttpRequest
// @grant GM_addStyle
// @grant GM_getValue
// @grant GM_setValue
// @connect localhost
// @connect self
// @connect cw-lsp-hub.fly.dev
// @require http://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js
// @require https://greasyfork.org/scripts/21927-arrive-js/code/arrivejs.js?version=198809
// @require https://cdnjs.cloudflare.com/ajax/libs/jquery-cookie/1.4.1/jquery.cookie.min.js
// @require http://ajax.googleapis.com/ajax/libs/jqueryui/1.11.1/jquery-ui.min.js
// @require https://cdn.jsdelivr.net/npm/marked/marked.min.js
// @require https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js
// ==/UserScript==

(async function() {
    'use strict';

    const TextDocumentSyncKind = {
        None: 0,
        Full: 1,
        Incremental: 2
    };

    const CompletionItemTag = {
        Deprecated: 1
    };

    const CompletionItemKind = {
        Text:           1,  Method:      2,
        Function:       3,  Constructor: 4,
        Field:          5,  Variable:    6,
        Class:          7,  Interface:   8,
        Module:         9,  Property:   10,
        Unit:          11,  Value:      12,
        Enum:          13,  Keyword:    14,
        Snippet:       15,  Color:      16,
        File:          17,  Reference:  18,
        Folder:        19,  EnumMember: 20,
        Constant:      21,  Struct:     22,
        Event:         23,  Operator:   24,
        TypeParameter: 25,
    }

    CompletionItemKind.allValues = [];
    Object.entries(CompletionItemKind).forEach(([kind, val]) => CompletionItemKind.allValues[val] = kind);

    const lspServiceUrl_ = "http://localhost:3000";
    const lspServiceUrl  = "https://cw-lsp-hub.fly.dev";

    let webSocket = null;

    var $ = window.jQuery;
    $.noConflict();
    const JQUERYUI_CSS_URL = '//ajax.googleapis.com/ajax/libs/jqueryui/1.11.1/themes/dark-hive/jquery-ui.min.css';
    jQuery("head").append(`
        <link href="${JQUERYUI_CSS_URL}" rel="stylesheet" type="text/css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css" type="text/css">
    `);

    GM_addStyle(`
  .diagnostics {
    width: 12px;
  }

  .cm-diagnostic-marker {
    color: #d00;
    font-size: 12px;
    cursor: pointer;
    text-align: center;
    line-height: 1;
  }

.cm-squiggle-error {
  text-decoration: underline wavy red;
}

.cm-squiggle-warning {
  text-decoration: underline wavy orange;
}

.cm-squiggle-info {
  text-decoration: underline wavy blue;
}

.cm-squiggle-hint {
  text-decoration: underline wavy gray;
}

#cwlsp-docsPanel pre {
  white-space: pre-wrap;
  overflow-x: hidden;
}

#cwlsp-docsPanel pre code {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

#cwlsp-docsPanel code.cwlsp-param-active {
  background: #ffeb3b;
}

#cwlsp-header {
  display: flex;
  align-items: center;
  height: 32px;
  padding: 0 6px;
}

#cwlsp-title {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

#cwlsp-toolbar {
  display: flex;
}

#cwlsp-logPanel ul {
  list-style: none;
  padding-left: 1.4em;
}

#cwlsp-logPanel li::marker {
  content: attr(data-icon) " ";
}

#cwlsp-logPanel li {
  line-height: 1.1;
  margin-bottom: 3px;
}

.lsp-plaintext {
    white-space: pre-wrap;
    font-family: inherit;
}

`);

    marked.use({ renderer: {
        code: function(code) {
            let { lang, text } = code;
            return '<pre><code>' + hljs.highlight(text, { language: lang || 'plaintext' }).value + '</code></pre>';
        }
    }});

    async function callLspService(trainerSessionId, endpoint, data) {
        let response = await GM.xmlHttpRequest({
            method: "POST",
            url: lspServiceUrl + endpoint,
            responseType: 'json',
            headers: {
                "Content-Type": "application/json"
            },
            data: JSON.stringify({
                trainerSessionId, data
            })
        });

        if(response.status !== 200) {
            const msg = `Request to LSP service failed with status ${response.status}`;
            console.log(msg);
            throw Error(msg);
        }
        return response.response;
    }

    function escapeHtml(s) {
        return String(s)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function lspDocumentationToHtml(doc) {
        
        // TODO: handle MarkedText | MarkedText[]
        
        if(!doc) return '';

        if(typeof doc === 'string') {
            return `<pre>${escapeHtml(doc)}</pre>`;
        }

        // MarkupContent: { kind: 'markdown' | 'plaintext', value: string }
        if(doc.kind === 'markdown') {
            return `<div>${marked.parse(doc.value ?? '')}</div>`;
        }
        return `<pre>${escapeHtml(doc.value ?? '')}</pre>`;
        // return `<div class="lsp-plaintext">${escapeHtml(doc.value ?? '')}</div>`;
    }

    function buildSignatureInfoHtml(signatureInfo) {
        if(!signatureInfo) return '';

        const signatureLabel = signatureInfo.label ?? '';
        const signatureDocHtml = lspDocumentationToHtml(signatureInfo.documentation);

        const parameters = signatureInfo.parameters ?? [];
        const paramsHtml = parameters.length ? parameters.map((p, idx) => {
            const labelSpec = p?.label;
            let labelText = '';
            if(Array.isArray(labelSpec) && labelSpec.length === 2 && typeof labelSpec[0] === 'number' && typeof labelSpec[1] === 'number') {
                labelText = signatureLabel.slice(labelSpec[0], labelSpec[1]);
            } else if(typeof labelSpec === 'string') {
                labelText = labelSpec;
            }

            const paramDocHtml = lspDocumentationToHtml(p?.documentation);
            return `
                <div class="cwlsp-param">
                    <div><code>${escapeHtml(labelText)}</code></div>
                    ${paramDocHtml ? `<div class="cwlsp-param-doc">${paramDocHtml}</div>` : ''}
                </div>
            `;
        }).join('') : '';

        return `
            <div class="cwlsp-signature">
                <pre><code>${escapeHtml(signatureLabel)}</code></pre>
                ${signatureDocHtml ? `<div class="cwlsp-signature-doc">${signatureDocHtml}</div>` : ''}
                ${paramsHtml ? `<h4>Parameters</h4><div class="cwlsp-params">${paramsHtml}</div>` : ''}
            </div>
        `;
    }

    function buildCompletionItemHtml(completionItem) {
        if(!completionItem) return '';

        let html = '<div class="cwlsp-completion">'
        const label = `${completionItem.label}${completionItem.labelDetails?.detail ?? ''}`;
        html += `<pre><code>${escapeHtml(label)}</pre></code>`;

        if(completionItem.labelDetails?.description) {
            html += `<p>${escapeHtml(completionItem.labelDetails.description)}</p>`;
        }

        let itemKind = CompletionItemKind.allValues[completionItem.kind ?? 0];
        let deprecated = completionItem?.tags?.includes(CompletionItemTag.Deprecated) ?? completionItem.deprecated ?? false;
        if(itemKind && deprecated) {
            html += `<p>${itemKind} <i>(deprecated)</i></p>`
        } else if(itemKind) {
            html += `<p>${itemKind}</p>`
        } else if(deprecated) {
            html += `<p><i>(deprecated)</i></p>`
        }

        if(completionItem.detail && completionItem.detail != completionItem.labelDetails?.description) {
            html += `<p>${escapeHtml(completionItem.detail)}</p>`;
        }

        if(completionItem.documentation) {
            html += "<div class='not-prose'><hr/></div>";
            html += lspDocumentationToHtml(completionItem.documentation);
        }
        html += "</div>";
        return html;
    }

    async function hintCodeCompletion(cm, serverCaps) {
        if(cm.somethingSelected()) {
            console.info("Selection detected, bailing out...");
            return null;
        }
        let trainerSessionId = jQuery("#code .CodeMirror")[0].dataset.lspTrainerSessionId;

        const cursor = cm.getCursor();
        const line = cursor.line;
        const pos = cursor.ch;

        let completionsResponse = await callLspService(trainerSessionId, "/get_completions", { line, pos });

        function getDisplayText(lspCompletionItem) {

            let label = `${lspCompletionItem.label}${lspCompletionItem.labelDetails?.detail ?? ""}`;

            if(lspCompletionItem.kind === 2 && lspCompletionItem.detail) {
                return `${label}: ${lspCompletionItem.detail}`;
            }
            if(lspCompletionItem.kind === 3 && lspCompletionItem.detail) {
                return `${label}: ${lspCompletionItem.detail}`;
            }

            return label;
        }

        function getText(lspCompletionItem) {
            return lspCompletionItem.textEdit?.newText ?? lspCompletionItem.label;
        }

        let currentToken = cm.getTokenAt(cm.getCursor());
        function isApplicable(lspCompletion) {
            let filterText = lspCompletion.filterText ?? lspCompletion.label;
            if(lspCompletion.textEdit) {
                let edit = lspCompletion.textEdit;
                let cmFrom = { line: edit.range.start.line, ch: edit.range.start.character };
                let cmTo = { line: edit.range.end.line, ch: edit.range.end.character };
                let textEditRange = cm.getRange(cmFrom, cmTo);
                return edit.newText.startsWith(textEditRange);
            } else {
                return filterText.startsWith(currentToken.string);
            }
        }

        function makeCompletions(lspCompletions) {

            let filtered = lspCompletions.filter(isApplicable);
            if(filtered.length)
                lspCompletions = filtered;
            return lspCompletions.map(c => ({
                text: getText(c),
                displayText: getDisplayText(c),
                lspItem: c,
                hint: function(cm, data, completion) {

                    let lspItem = completion.lspItem;
                    if(lspItem.textEdit) {
                        let from = lspItem.textEdit.range.start.character;
                        let to = lspItem.textEdit.range.end.character;
                        cm.replaceRange(lspItem.textEdit.newText, {line, ch: from }, { line, ch: to });
                    } else {
                        if(lspItem.label.startsWith(currentToken.string)) {
                            cm.replaceRange(lspItem.label, { line, ch: currentToken.start }, {line, ch: currentToken.end });
                        } else {
                            cm.replaceRange(lspItem.label, cursor);
                        }
                    }
                }
            }));
        }

        let completions = completionsResponse.completions;
        if(!completions) return false;

        let completionData = {
            list: makeCompletions(completions),
            from: cursor,
            to: cursor
        };

        cm.constructor.on(completionData, "select", async function(item) {
            let lsp = item?.lspItem;
            if(!lsp) return;
            jQuery('#cwlsp-docsPanel').html(buildCompletionItemHtml(lsp));

            if(!serverCaps.completionProvider?.resolveProvider)
                return;
            if(item.resolved)
                return;

            let resolveCompletionResponse = await callLspService(trainerSessionId, "/resolve_completion", { completionItem: lsp });
            let resolved = resolveCompletionResponse.resolvedCompletion;
            item.lspItem = resolved;
            item.resolved = true;
            jQuery('#cwlsp-docsPanel').html(buildCompletionItemHtml(resolved));
        });

        return completionData;
    }

    async function hintCallParams(cm) {
        if(cm.somethingSelected()) {
            console.info("Selection detected, bailing out...");
            return null;
        }

        let trainerSessionId = jQuery("#code .CodeMirror")[0].dataset.lspTrainerSessionId;

        const cursor = cm.getCursor();
        const line = cursor.line;
        const pos = cursor.ch;

        let signatureHintReponse = await callLspService(trainerSessionId, "/get_call_params", { line, pos });

        function getDisplayText(lspCompletionItem) {
            return lspCompletionItem.label;
        }

        function getText(lspCompletionItem) {
            return lspCompletionItem.label;
        }

        function makeCompletions(lspCompletions) {
            return lspCompletions.map(c => ({
                text: getText(c),
                displayText: getDisplayText(c),
                lspItem: c,
                hint: function(cm, data, completion) { /* do nothing */ }
            }));
        }

        if(!signatureHintReponse.callParamHints)
            return false;
        let completionData = {
            list: makeCompletions(signatureHintReponse.callParamHints),
            from: cursor,
            to: cursor
        };

        cm.constructor.on(completionData, "select", function(item) {
            let lsp = item.lspItem;
            let html = buildSignatureInfoHtml(lsp);
            jQuery('#cwlsp-docsPanel').html(html)
        });
        return completionData;
    }

    function buildHoverHintHtml(hoverHint) {
        let { contents } = hoverHint;
        if(contents.kind) {
            return lspDocumentationToHtml(contents);
        } else {
            console.info('MarkedString is currently not supported');
        }
    }

    async function showHoverHint(cm) {
        if(cm.somethingSelected()) {
            console.info("Selection detected, bailing out...");
            return null;
        }
        let trainerSessionId = jQuery("#code .CodeMirror")[0].dataset.lspTrainerSessionId;

        const cursor = cm.getCursor();
        const line = cursor.line;
        const pos = cursor.ch;

        let hoverHintResponse = await callLspService(trainerSessionId, "/get_hover", { line, pos });
        if(!hoverHintResponse?.hover) {
            return;
        }
        jQuery('#cwlsp-docsPanel').html(buildHoverHintHtml(hoverHintResponse.hover));

    }

    async function initLsp(kataId, language, trainerSessionId, userId, initialCode) {

        let sessionInfo = {
            language,
            userId,
            trainerSessionId,
            kataId
        };

        let initData = await callLspService(trainerSessionId, "/init_lsp_session", { sessionInfo, initialCode } );
        return initData;
    }

    const diagnosticMarks = [];
    function clearDiagnostics(cm) {
        cm.clearGutter('diagnostics');
        diagnosticMarks.forEach(m => m.clear());
        diagnosticMarks.length = 0;
    }

    function publishDiagnostics(lspDiagnostics, cm) {

        function getSymbol(severity) {
            let icons = ["❔", "⛔", "⚠️", "ℹ️", "💡"];
            return icons[severity ?? 1] ?? icons[1];
        }

        function getSquiggleClass(severity) {
            let classes = ["hint", "error", "warning", "info", "hint"];
            let className = classes[severity ?? 1] ?? classes[1];
            return `cm-squiggle-${className}`;
        }

        function makeMarker(symbol, title) {
            const el = document.createElement("div");
            el.className = "cm-diagnostic-marker";
            el.textContent = symbol;
            el.title = title;
            return el;
        }

        clearDiagnostics(cm);
        let { uri, version, diagnostics } = lspDiagnostics;
        let linesDiags = [];
        for(let diag of diagnostics) {
            let line = diag.range.start.line;
            if(linesDiags[line])
                linesDiags[line].push(diag);
            else
                linesDiags[line] = [diag];
        }
        for (const lineDiags of Object.values(linesDiags)) {
            lineDiags.sort((d1, d2) => (d2.severity ?? 1) - (d1.severity ?? 1)); // Errors last
            for(const diag of lineDiags) {
                const { range, severity, message } = diag;
                let from = { line: range.start.line, ch: range.start.character };
                let to = { line: range.end.line, ch: range.end.character };
                const mark = cm.markText(from, to, {
                        className: getSquiggleClass(severity),
                        title: message
                    });
                diagnosticMarks.push(mark);
            }
            const { range, severity, message } = lineDiags.at(-1);
            if(lineDiags.length === 1) {
                cm.setGutterMarker(range.start.line, 'diagnostics', makeMarker(getSymbol(severity), message));
            } else {
                let message = `(${lineDiags.length} markers)\n\n${lineDiags.map(d => getSymbol(d.severity) + ' ' + d.message).join('\n\n')}`;
                cm.setGutterMarker(range.start.line, 'diagnostics', makeMarker(getSymbol(severity), message));
            }
        }
    }

    function publishLogMessage(message, type) {
        let icons = ["❔", "⛔", "⚠️", "ℹ️", "💡"];
        let icon = icons[type] ?? icons[0];
        jQuery("#cwlsp-logPanel ul").append(jQuery("<li>").attr("data-icon", icon).text(message));
    }

    function publishProgressMessage(token, progressValue) {
        if(!token || !progressValue)
            return;
        let { kind, title } = progressValue;
        if(kind === "begin" && title) {
            jQuery("#cwlsp-logPanel ul").append(jQuery("<li>").attr("data-icon", "⏳").attr("data-cwlspProgressToken", token).text(title));
        } else if(kind === "end") {
            jQuery(`#cwlsp-logPanel ul li[data-cwlspProgressToken="${token}"]`)
                .attr("data-icon", "✅")
                .removeAttr("data-cwlspProgressToken");
        }
    }

    function initLspPanel() {

        if(document.getElementById('cwLspDialog'))
            return;

        const DIALOG_STATE_KEY = "cwlsp.dialogState";

        function loadDialogState() {
            try {
                const parsed = GM_getValue(DIALOG_STATE_KEY, null);
                if(!parsed || typeof parsed !== "object") return null;
                return parsed;
            } catch(e) {
                console.warn("Failed to get dialog state.", JSON.stringify(e));
                return null;
            }
        }

        function saveDialogOpenState(isOpen) {
            try {
                const state = GM_getValue(DIALOG_STATE_KEY, {});
                state.isOpen = isOpen;
                GM_setValue(DIALOG_STATE_KEY, state);
            } catch(e) {
                console.warn("Failed to save dialog open state.", JSON.stringify(e));
            }
        }

        function saveDialogPosition(dialog) {
            try {
                const { my, at } = dialog.dialog("option", "position");
                const state = GM_getValue(DIALOG_STATE_KEY, {});
                state.width = dialog.dialog("option", "width");
                state.height = dialog.dialog("option", "height");
                state.position = { my, at };
                GM_setValue(DIALOG_STATE_KEY, state);
            } catch(e) {
                console.warn("Failed to save dialog posiion.", JSON.stringify(e));
            }
        }

        const state = loadDialogState();

        jQuery('body').append(`
    <div id='cwLspDialog' title='Codewars LSP'>
<div id="cwlsp-header">
  <span id="cwlsp-title">Documentation</span>

  <div id="cwlsp-toolbar">
    <input type="radio" name="cwlsp" id="cwlsp-docs" checked>
    <label for="cwlsp-docs" title="Documentation">📙</label>

    <input type="radio" name="cwlsp" id="cwlsp-log">
    <label for="cwlsp-log" title="Messages & Logs">📜</label>

    <input type="radio" name="cwlsp" id="cwlsp-about">
    <label for="cwlsp-about" title="About">❔</label>
  </div>
</div>
      <div id="lspDialogTabs">
        <div id='cwlsp-docsPanel' class="prose"></div>
        <div id='cwlsp-logPanel'>
            <ul style="font-family: monospace; list-style: none; margin: 0; line-height: 1em;"/>
        </div>
        <div id='cwlsp-aboutPanel' class="prose">
            <h1>Codewars LSP</h1>
            <p><code>cw-lsp</code> is a community extension for Codewars which adds Language Server Protocol support to Codewars trainer.</p>
            <p>Visit <code>cw-lsp</code> on <a href="https://github.com/hobovsky/cw-lsp">Github</a> for (some) details.</p>
            <hr/>
            <h2>Keys</h2>
            <p><code>cw-lsp</code> uses following key shortcuts:</p>
            <ul>
                <li><kbd><kbd>Shift</kbd>-<kbd>Space</kbd></kbd> - show code completion suggestions. <kbd>Enter</kbd> to insert currently selected suggestion, <kbd>Esc</kbd> to dismiss.</li>
                <li><kbd><kbd>Alt</kbd>-<kbd>A</kbd></kbd> - show function signature help when typing a function call.</li>
                <li><kbd><kbd>Alt</kbd>-<kbd>H</kbd></kbd> - show documentation of a symbol under caret.</li>
            </ul>
        </div>
      </div>
    </div>`);
        jQuery( "#cwlsp-toolbar" ).buttonset();
        jQuery("#lspDialogTabs > div").hide();
        jQuery("#cwlsp-docsPanel").show();
        jQuery("#cwlsp-toolbar input").on("change", function () {
            const label = $("label[for='" + this.id + "']").attr("title");
            $("#cwlsp-title").text(label);

            $("#lspDialogTabs > div").hide();
            $("#" + this.id + "Panel").show();
        });

        const dialog = jQuery('#cwLspDialog').dialog({
            autoOpen: state?.isOpen ?? false,
            height: state?.height ?? 300,
            width: state?.width ?? 600,
            position: {
                my: state?.position?.my ?? "left top",
                at: state?.position?.at ?? "left+20 top+20",
                of: window },
            modal: false,
            buttons: [ ],
            dragStop: function() { saveDialogPosition(dialog); },
            resizeStop: function() { saveDialogPosition(dialog); },
            close: function() { saveDialogOpenState(false); },
            open: function() { saveDialogOpenState(true); },
        });

        return dialog;
    }

    function setUpLspButton() {
        if(jQuery('#btnToggleLspDialog').length)
            return;

        jQuery('#language_dd').closest('ul').append('<li style="margin-left: 12px"><a class="btn is-dark" id="btnToggleLspDialog">LSP</a></li>');

        jQuery('#btnToggleLspDialog').on('click', function (e) {
            const dialog = jQuery('#cwLspDialog');
            if(dialog.dialog('isOpen')) {
                dialog.dialog('close');
            } else {
                dialog.dialog('open');
            }
        });
    }

    async function cleanUpOldState() {

        let editorElem = jQuery("#code .CodeMirror")[0];
        delete editorElem.dataset.lspTrainerSessionId;
        let editor = editorElem.CodeMirror;

        if (editor._cwlspOnChanges) {
            editor.off("changes", editor._cwlspOnChanges);
            delete editor._cwlspOnChanges;
        }

        if(editor._cwlspKeyMap) {
            editor.removeKeyMap(editor._cwlspKeyMap);
            delete editor._cwlspKeyMap;
        }
    }

    async function setUpEverything() {

        let url = window.location.pathname.split('/');
        let language = url[4];

        let editorElem = jQuery("#code .CodeMirror")[0];
        let trainerSessionId = crypto.randomUUID();
        editorElem.dataset.lspTrainerSessionId = trainerSessionId;
        let editor = editorElem.CodeMirror;

        /**/
        const gutters = editor.getOption("gutters").slice();
        if (!gutters.includes("diagnostics")) {
            gutters.push("diagnostics");
            editor.setOption("gutters", gutters);
        }
        /**/

        webSocket?.close(3002, "Kata trainer reloaded.");
        webSocket = new WebSocket(lspServiceUrl.replace('http', 'ws') + `/lsp-ws?trainerSessionId=${trainerSessionId}`);
        webSocket.onopen = () => {
            console.info("Web socket connection established");
        };
        webSocket.onmessage = (event) => {
            const { method, params } = JSON.parse(event.data);
            switch(method) {
                case "textDocument/publishDiagnostics":
                    publishDiagnostics(params, editor);
                    break;
                case "window/logMessage":
                case "window/showMessage":
                    const { type, message } = params;
                    publishLogMessage(message, type);
                    break;
                case "window/workDoneProgress/create":
                    // ignore (for now)
                    break;
                case "$/progress":
                    const { token, value } = params;
                    publishProgressMessage(token, value);
                    break;
                default:
                    console.log(event.data);
                    break;
            }
        };

        let userId = App.instance.currentUser.id;
        let kataId = url[2];
        let code = editor.getValue();
        let initLspResponse = await initLsp(kataId, language, trainerSessionId, userId, code);
        jQuery(document).leave("#code", { onceOnly: true}, function(codeElem) {

            // Switching editor to fullscreen and back manipulates DOM
            // in a way which triggers arrive.js's `leave` even though
            // the editor is still kept in the document.
            if(document.contains(codeElem))
               return;

            webSocket.close(3001, "Trainer editor unloaded.");
        })

        let serverCaps = initLspResponse?.serverCapabilities;

        let documentSyncKind = TextDocumentSyncKind.None;
        if(typeof serverCaps?.textDocumentSync?.change === 'number')
            documentSyncKind = serverCaps.textDocumentSync.change;
        else if(typeof serverCaps?.textDocumentSync === 'number')
            documentSyncKind = serverCaps.textDocumentSync;

        editor._cwlspTrainerSessionId = trainerSessionId;
        editor._cwlspOnChanges = async (cm, changes) => {

            let updateData = { };
            if (documentSyncKind === TextDocumentSyncKind.Full) {
                updateData.updatedContent = cm.getValue();
            } else if (documentSyncKind === TextDocumentSyncKind.Incremental) {
                updateData.changes = changes;
            }

            await callLspService(cm._cwlspTrainerSessionId, "/update_doc", updateData);
        };

        if(documentSyncKind !== TextDocumentSyncKind.None) {
            editor.on("changes", editor._cwlspOnChanges);
        }

        editor._cwlspKeyMap = {
            "Shift-Space": function (cm) {
                cm.showHint({ hint: cm => hintCodeCompletion(cm, serverCaps), completeSingle: false });
            },
            "Alt-A": function (cm) {
                cm.showHint({ hint: cm => hintCallParams(cm, serverCaps), completeSingle: false, closeCharacters: /[)\]]/ });
            },
            "Alt-H": function (cm) {
                showHoverHint(cm);
            }
        }
        editor.addKeyMap(editor._cwlspKeyMap);
        initLspPanel();
        setUpLspButton();
    }

    async function setUpAfterRenderHook() {
        if (App.instance.controller.afterRenderHookActive) return;
        const original = App.instance.controller.afterRender;
        App.instance.controller.afterRender = function () {
            cleanUpOldState();
            const result = original.apply(App.instance.controller);
            setUpEverything();
            return result;
        };
        App.instance.controller.afterRenderHookActive = true;
    }

    async function setUpArriveHook() {
        jQuery(document).arrive("#code div.CodeMirror", { existing: true, onceOnly: false }, () => {

            const supportedLangs = ["javascript", "php", "python", "rust"];

            let url = window.location.pathname.split('/');
            if(url[3] !== "train")
                return;
            let language = url[4];
            if(!supportedLangs.includes(language))
                return;
            setUpAfterRenderHook();
        });
    }

    async function setUpProxyHook() {
        if (App.instance.controller.afterRenderHookActive) return;

        App.instance.controller = new Proxy(App.instance.controller, {
            get(obj, prop, receiver) {
                const value = Reflect.get(obj, prop, receiver);

                if (prop === "afterRender" && typeof value === "function") {
                    return function (...args) {
                        console.log("afterRender called");
                        const result = value.apply(this, args);
                        setUpEverything();
                        return result;
                    };
                }

                return value;
            }
        });

        App.instance.controller.afterRenderHookActive = true;
    }

    setUpArriveHook();
})();
