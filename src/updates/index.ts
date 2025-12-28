import type { CodeMirrorChange } from "../cmTypes.js";
import { getLspSession, type LspSessionKey } from "../sessions/index.js";

export async function updateDoc(lspSessionKey: LspSessionKey, changes: CodeMirrorChange[] | string) {
  
  let lspSession = getLspSession(lspSessionKey);  
  lspSession.languageServer.killTimer?.refresh();
  let {connection, docUri } = lspSession.languageServer;

    if(typeof changes === 'string') {
        connection.sendNotification("textDocument/didChange", {
            textDocument: { uri: docUri, version: ++lspSession.languageServer.docVersion },
            contentChanges: [
            {
                text: changes,
            }
            ]
        })
    } else {
        throw Error("Partial updates are not supported yet.");
    }
}