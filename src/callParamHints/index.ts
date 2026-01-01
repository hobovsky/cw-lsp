import { getLspSession } from "../sessions/index.js";

export async function getCallParamHints(trainerSessionId: string, line: number, charPos: number): Promise<string[]> {

  let lspSession = getLspSession(trainerSessionId);
  
  lspSession.languageServer.killTimer?.refresh();
  const completionPosition = { line, character: charPos };

  let { connection, docUri } = lspSession.languageServer;

  console.log("Requesting signature help...");
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
  return list;
}
