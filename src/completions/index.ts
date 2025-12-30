import { getLspSession, type LspSessionKey } from "../sessions/index.js";

export async function getCompletions(lspSessionKey: LspSessionKey, line: number, charPos: number): Promise<string[]> {

  let lspSession = getLspSession(lspSessionKey);
  
  lspSession.languageServer.killTimer?.refresh();
  const completionPosition = { line, character: charPos };

  let { connection, docUri } = lspSession.languageServer;

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
  return list;
}
