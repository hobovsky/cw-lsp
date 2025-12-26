// ==UserScript==
// @name         LSP Integration for Codewars
// @namespace    hob.cw
// @version      2025-12-21
// @description  try to take over the world!
// @author       Hobovsky (hobson@wp.pl)
// @match        https://www.codewars.com/kata/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant GM.xmlHttpRequest
// @connect localhost
// @connect self
// @require http://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js
// @require https://greasyfork.org/scripts/21927-arrive-js/code/arrivejs.js?version=198809
// @require https://cdnjs.cloudflare.com/ajax/libs/jquery-cookie/1.4.1/jquery.cookie.min.js
// ==/UserScript==

(async function() {
    'use strict';

    const lspServiceUrl = "http://localhost:3000";

    var $ = window.jQuery;
    $.noConflict();

    async function myHint(cm) {
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

        let code = cm.getValue();
        let lang = cm.options.mode;

        let lspSession = getLspSession();

        let response = await GM.xmlHttpRequest({
            method: "POST",
            url: lspServiceUrl + "/get_completions",
            responseType: 'json',
            headers: {
                "Content-Type": "application/json"
            },
            data: JSON.stringify({
                lspSession,code,line,pos
            })
        });

        if(response.status !== 200) {
            console.log("Request failed with status ", response.status);
            return;
        }

        function getDisplayText(lspCompletionItem) {

            if(lspCompletionItem.kind === 2 && lspCompletionItem.detail) {
                return `${lspCompletionItem.label}: ${lspCompletionItem.detail}`;
            }

            return lspCompletionItem.label;
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
                    console.info("Committed completion: ", completion);

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
        return {
            list: makeCompletions(lspResponse.completions),
            from: cursor,
            to: cursor
        };
    }

    const supportedLangs = ["rust", "python"];

    async function initLsp(kataId, language, editorId, userId) {
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
                editorId, kataId
            })
        });

        if(response.status !== 200) {
            console.log("InitLsp request failed with status ", response.status);
            return;
        }

        console.info("LSP initialized");
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

        let initLspResponse = initLsp(url[2], url[4], editorId, App.instance.currentUser.id);

        editor.addKeyMap({
            "Shift-Space": function (cm) {
                console.info(`Shift+Space hit on token [${JSON.stringify(cm.getTokenAt(cm.getCursor()), null, 2)}]`);
                cm.showHint({ hint: myHint,
                            completeSingle: false });
            }
        });
    });
})();
