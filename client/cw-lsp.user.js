// ==UserScript==
// @name         LSP Integration for Codewars
// @namespace    lsp.cw.hobovsky
// @version      2025-12-28-002
// @author       hobovsky
// @updateURL    https://github.com/hobovsky/cw-lsp/raw/refs/heads/main/client/cw-lsp.user.js
// @downloadURL  https://github.com/hobovsky/cw-lsp/raw/refs/heads/main/client/cw-lsp.user.js
// @match        https://www.codewars.com/kata/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant GM.xmlHttpRequest
// @grant GM_addStyle
// @connect localhost
// @connect self
// @connect cw-lsp-hub.fly.dev
// @require http://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js
// @require https://greasyfork.org/scripts/21927-arrive-js/code/arrivejs.js?version=198809
// @require https://cdnjs.cloudflare.com/ajax/libs/jquery-cookie/1.4.1/jquery.cookie.min.js
// ==/UserScript==

(async function() {
    'use strict';

    const lspServiceUrl_ = "http://localhost:3000";
    const lspServiceUrl  = "https://cw-lsp-hub.fly.dev";

    var $ = window.jQuery;
    $.noConflict();

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

`);

    async function hintCodeCompletion(cm) {
        if(cm.somethingSelected()) {
            console.info("Selection detected, bailing out...");
            return null;
        }

        function getLspSession() {
            let url = window.location.pathname.split('/');
            return {
                language: url[4],
                userId: App.instance.currentUser.id,
                kataId: url[2],
                editorId: jQuery("#code .CodeMirror")[0].dataset.lspEditorId
            };
        }

        const cursor = cm.getCursor();
        const line = cursor.line;
        const pos = cursor.ch;
        let lspSession = getLspSession();

        let response = await GM.xmlHttpRequest({
            method: "POST",
            url: lspServiceUrl + "/get_completions",
            responseType: 'json',
            headers: {
                "Content-Type": "application/json"
            },
            data: JSON.stringify({
                lspSession,line,pos
            })
        });

        if(response.status !== 200) {
            console.log("Request failed with status ", response.status);
            return;
        }

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

        let lspResponse = response.response;
        let completions = lspResponse.completions;
        return completions && {
            list: makeCompletions(completions),
            from: cursor,
            to: cursor
        };
    }

    async function hintCallParams(cm) {
        if(cm.somethingSelected()) {
            console.info("Selection detected, bailing out...");
            return null;
        }

        function getLspSession() {
            let url = window.location.pathname.split('/');
            return {
                language: url[4],
                userId: App.instance.currentUser.id,
                kataId: url[2],
                editorId: jQuery("#code .CodeMirror")[0].dataset.lspEditorId
            };
        }

        const cursor = cm.getCursor();
        const line = cursor.line;
        const pos = cursor.ch;

        let lspSession = getLspSession();

        let response = await GM.xmlHttpRequest({
            method: "POST",
            url: lspServiceUrl + "/get_call_params",
            responseType: 'json',
            headers: {
                "Content-Type": "application/json"
            },
            data: JSON.stringify({
                lspSession,line,pos
            })
        });

        if(response.status !== 200) {
            console.log("Request failed with status ", response.status);
            return;
        }

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

        let lspResponse = response.response;
        return lspResponse.callParamHints && {
            list: makeCompletions(lspResponse.callParamHints),
            from: cursor,
            to: cursor
        };
    }

    const supportedLangs = ["javascript", "php", "python", "rust"];

    async function initLsp(kataId, language, editorId, userId, initialCode) {
        let response = await GM.xmlHttpRequest({
            method: "POST",
            url: lspServiceUrl + "/init_lsp_session",
            responseType: 'json',
            headers: {
                "Content-Type": "application/json"
            },
            data: JSON.stringify({
                language,
                userId,
                editorId,
                kataId,
                initialCode
            })
        });

        if(response.status !== 200) {
            console.log("InitLsp request failed with status ", response.status);
            return;
        }

        console.info("LSP initialized");
    }

    const diagnosticMarks = [];
    function clearDiagnostics(cm) {
        cm.clearGutter('diagnostics');
        diagnosticMarks.forEach(m => m.clear());
        diagnosticMarks.length = 0;
    }


    function publishDiagnostics(lspDiagnostics, cm) {

        function getSymbol(severity) {
            let icons = ["?", "⛔", "⚠️", "ℹ️", "💡"];
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

    jQuery(document).arrive("#code div.CodeMirror", { existing: true, onceOnly: false }, function() {
        let url = window.location.pathname.split('/');
        if(url[3] !== "train")
            return;
        let language = url[4];
        console.info("Language: ", language);
        if(!supportedLangs.includes(language))
            return;

        let editorElem = jQuery("#code .CodeMirror")[0];
        let editorId = crypto.randomUUID();
        editorElem.dataset.lspEditorId = editorId;
        let editor = editorElem.CodeMirror;

        /**/
        const gutters = editor.getOption("gutters").slice();
        if (!gutters.includes("diagnostics")) {
            gutters.push("diagnostics");
            editor.setOption("gutters", gutters);
        }
        /**/

        let userId = App.instance.currentUser.id;
        let kataId = url[2];
        let code = editor.getValue();
        let initLspResponse = initLsp(kataId, language, editorId, userId, code);
        let webSocket = new WebSocket(lspServiceUrl.replace('http', 'ws') + `/lsp-ws?userId=${userId}&editorId=${editorId}&kataId=${kataId}&language=${language}`);
        webSocket.onopen = () => {
            console.info("Web socket connection established");
        };
        webSocket.onmessage = (event) => {
            const { method, params } = JSON.parse(event.data);
            console.info("method:", method);
            switch(method) {
                case "textDocument/publishDiagnostics":
                    publishDiagnostics(params, editor);
                    break;
                default: console.log(event.data); break;
            }
        };

        editor.on("changes", async (cm, changes) => {

            let lspSession = {
                language,
                userId,
                kataId,
                editorId
            };

            // TODO: choose between full updates and incremental updates depending on reported server capabilities.
            // let updatedContent = editor.getValue();
            let response = await GM.xmlHttpRequest({
                method: "POST",
                url: lspServiceUrl + "/update_doc",
                responseType: 'json',
                headers: {
                    "Content-Type": "application/json"
                },
                data: JSON.stringify({
                    lspSession,
                    // updatedContent, // incremental update
                    changes
                })
            });

            if(response.status !== 200) {
                console.log("Request failed with status ", response.status);
                return;
            }
        });

        editor.addKeyMap({
            "Shift-Space": function (cm) {
                cm.showHint({ hint: hintCodeCompletion, completeSingle: false });
            },
            "Alt-A": function (cm) {
                cm.showHint({ hint: hintCallParams, completeSingle: false, closeCharacters: /[)\]]/ });
            }
        });


    });
})();
