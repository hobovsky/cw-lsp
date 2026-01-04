import type { CompletionItem, Hover } from "vscode-languageserver-protocol";
import { getLspSession } from "../sessions/index.js";

export async function getHoverHint(trainerSessionId: string, line: number, charPos: number): Promise<Hover> {

  let lspSession = getLspSession(trainerSessionId);
  
  lspSession.languageServer.killTimer?.refresh();
  const hoverPosition = { line, character: charPos };

  let { connection, docUri } = lspSession.languageServer;

  console.log("Requesting hover...");
  const completion = await connection.sendRequest(
    "textDocument/hover",
    {
      textDocument: { uri: docUri },
      position: hoverPosition
    }
  );

  return completion as Hover;
}
