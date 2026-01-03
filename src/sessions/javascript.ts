import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from "vscode-jsonrpc/lib/node/main.js";
import type {
  InitializeParams,
  InitializeResult,
} from "vscode-languageserver-protocol";
import { spawn } from "child_process";
import type { LanguageServerSession } from "./index.js";
import { registerDefaultServerRequestHandlers, registerDefaultWorkspaceConfigurationHandler } from "./common.js";
import { CLIENT_CAPABILITIES } from "./common.js";

import { pathToFileURL } from "node:url";
import path from "node:path";

const TEMPLATES = process.env.LSP_TEMPLATES_DIR;
if (!TEMPLATES) throw Error("LSP_TEMPLATES_DIR not set");

const jsProjectRoot = path.join(TEMPLATES, "javascript");
const jsFile = path.join(jsProjectRoot, "solution.js");

const jsUri = pathToFileURL(jsFile).toString();
const projectRoot = pathToFileURL(jsProjectRoot).toString();

export async function initJavaScriptLsp(trainerSessionId: string, code: string): Promise<LanguageServerSession> {
  const cp = spawn(
    "typescript-language-server",
    ["--stdio"],
    {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    }
  );
  const reader = new StreamMessageReader(cp.stdout);
  const writer = new StreamMessageWriter(cp.stdin);

  const connection = createMessageConnection(reader, writer);

  cp.stderr.on("data", (d) => console.error("tsls stderr:", d.toString()));

  registerDefaultWorkspaceConfigurationHandler(trainerSessionId, connection);
  registerDefaultServerRequestHandlers(trainerSessionId, connection);
  connection.listen();

  const params: InitializeParams = {
    processId: process.pid,
    rootUri: projectRoot,
    workspaceFolders: [{ uri: projectRoot, name: "javascript" }],
    capabilities: CLIENT_CAPABILITIES,

  };

  let initialized = await connection.sendRequest("initialize", params as any) as InitializeResult;
  console.log(`typescript-language-server initialized.`);

  connection.sendNotification("initialized", {});
  connection.sendNotification("textDocument/didOpen", {
    textDocument: {
      uri: jsUri,
      languageId: "javascript",
      version: 1,
      text: code,
    },
  });

  return {
    connection: connection,
    process: cp,
    docUri: jsUri,
    docVersion: 1,
    serverCapabilities: initialized?.capabilities,
  };
}
