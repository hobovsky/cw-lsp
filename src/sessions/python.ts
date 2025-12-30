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
if(!TEMPLATES)
  throw Error("LSP_TEMPLATES_DIR not set");

const pythonProjectRoot = path.join(TEMPLATES, "python");
const pythonFile = path.join(pythonProjectRoot, "solution.py");

const pythonUri = pathToFileURL(pythonFile).toString();
const projectRoot = pathToFileURL(pythonProjectRoot).toString();

export async function initPythonLsp(code: string): Promise<LanguageServerSession> {

  const cp = spawn("pyright-langserver",
  ["--stdio"],
  {
    stdio: ["pipe", "pipe", "pipe"],
    shell: true
  });
  const reader = new StreamMessageReader(cp.stdout);
  const writer = new StreamMessageWriter(cp.stdin);

  const connection = createMessageConnection(reader, writer);

  cp.stderr.on("data", (d) => console.error("pyright stderr:", d.toString()));

  registerDefaultWorkspaceConfigurationHandler(connection);
  registerDefaultServerRequestHandlers(connection);
  connection.listen();

  const params: InitializeParams = {
    processId: process.pid,
    rootUri: projectRoot,
    workspaceFolders: [ { uri: projectRoot, name: "python" } ],
    capabilities: CLIENT_CAPABILITIES,
  };

  let initialized = await connection.sendRequest("initialize", params as any) as InitializeResult;
  console.log(`pyright initialized.`);

  connection.sendNotification("initialized", {});
  connection.sendNotification("textDocument/didOpen", {
    textDocument: {
      uri: pythonUri,
      languageId: "python",
      version: 1,
      text: code,
    },
  });

  return {
    connection: connection,
    process: cp,
    docUri: pythonUri,
    docVersion: 1,
    serverCapabilities: initialized?.capabilities
  };
}
