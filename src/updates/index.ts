import type { CodeMirrorChange } from "../cmTypes.js";
import { getLspSession } from "../sessions/index.js";

export async function updateDoc(trainerSessionId: string, changes: CodeMirrorChange[] | string) {
  
    let lspSession = getLspSession(trainerSessionId);  
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