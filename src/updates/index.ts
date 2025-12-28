import type { CodeMirrorChange } from "../cmTypes.js";
import { getLspSession, type LspSessionKey } from "../sessions/index.js";

export async function updateDoc(lspSessionKey: LspSessionKey, changes: CodeMirrorChange[] | string) {
  
  let lspSession = getLspSession(lspSessionKey);  
  lspSession.languageServer.killTimer?.refresh();
  let {connection, docUri } = lspSession.languageServer;

    if(typeof changes === 'string') {
        connection.sendNotification("textDocument/didChange", {
            textDocument: { uri: docUri, version: ++lspSession.languageServer.docVersion },
            contentChanges: [ { text: changes } ]
        });
    } else {
        let contentChanges = changes.map(cm => ({
            range: {
                start: { line: cm.from.line, character: cm.from.ch },
                end:   { line: cm.to.line,   character: cm.to.ch }
            },
            text: cm.text.join("\n")
        }));
        connection.sendNotification("textDocument/didChange", {
            textDocument: { uri: docUri, version: ++lspSession.languageServer.docVersion },
            contentChanges
        });
    }
}