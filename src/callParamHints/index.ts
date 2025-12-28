import { getLspSession, type LspSessionKey } from "../sessions/index.js";

export async function getCallParamHints(lspSessionKey: LspSessionKey, line: number, charPos: number): Promise<string[]> {

  let lspSession = await getLspSession(lspSessionKey);
  
  lspSession.languageServer.killTimer?.refresh();
  const completionPosition = { line, character: charPos };

  let { connection, docUri } = lspSession.languageServer;

  console.log("Requesting completion...");
  const completion = await connection.sendRequest(
    "textDocument/signatureHelp",
    {
      textDocument: { uri: docUri },
      position: completionPosition,
      context: {
        triggerKind: 1, // Invoked
        isRetrigger: false
      },
    }
  );

  let list = (completion as any)?.signatures;

  console.info(`LSP reported ${list?.length} signatures.`);

  return list;
}
