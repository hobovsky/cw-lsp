import type { CompletionItem } from "vscode-languageserver-protocol";
import { getLspSession } from "../sessions/index.js";

export async function getCompletions(trainerSessionId: string, line: number, charPos: number): Promise<CompletionItem[]> {

  let lspSession = getLspSession(trainerSessionId);
  
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

export async function resolveCompletion(trainerSessionId: string, completionItem: CompletionItem): Promise<CompletionItem> {

  let lspSession = getLspSession(trainerSessionId);  
  lspSession.languageServer.killTimer?.refresh();  
  console.log("Resolving completion...");

  const resolvedCompletion = await lspSession.languageServer.connection.sendRequest(
    "completionItem/resolve",
    completionItem
  );

  return resolvedCompletion as CompletionItem;
}
