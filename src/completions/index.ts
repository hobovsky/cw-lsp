import { ensureLspSession, type LspSessionKey } from "../sessions/index.js";

export async function getCompletions(lspSessionKey: LspSessionKey, code: string, language: string, line: number, charPos: number): Promise<string[]> {

  let lspSession = await ensureLspSession(lspSessionKey);
  if(!lspSession) {
    throw Error(`LSP not initialized for ${JSON.stringify(lspSession)}.`)
  }
  
  lspSession.languageServer.killTimer?.refresh();
  const completionPosition = { line, character: charPos };

  let { connection, docUri } = lspSession.languageServer;
  // Nudge with a didChange to ensure the server has the latest contents.
  connection.sendNotification("textDocument/didChange", {
    textDocument: { uri: docUri, version: ++lspSession.languageServer.docVersion },
    contentChanges: [
      {
        text: code,
      },
    ],
  });

  await new Promise((r) => setTimeout(r, 100)); // small delay before completion

  console.log("Requesting completion...");
  const completion = await connection.sendRequest(
    "textDocument/completion",
    {
      textDocument: { uri: docUri },
      position: completionPosition,
      context: {
        triggerKind: 1, // Invoked
      },
    }
  );


  let list = completion as any;
  if(!Array.isArray(list))
    list = list?.items;

  console.info(`LSP reported ${list.length} completion items.`);

  return list;
}
