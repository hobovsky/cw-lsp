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

const rustProjectRoot = path.join(TEMPLATES, "rust");
const rustFile = path.join(rustProjectRoot, "src", "lib.rs");

const rustUri = pathToFileURL(rustFile).toString();
const projectRoot = pathToFileURL(rustProjectRoot).toString();

export async function initRustLsp(code: string): Promise<LanguageServerSession> {

  const cp = spawn("rust-analyzer");
  const reader = new StreamMessageReader(cp.stdout);
  const writer = new StreamMessageWriter(cp.stdin);

  const connection = createMessageConnection(reader, writer);

  cp.stderr.on("data", (d) => console.error("RA stderr:", d.toString()));
  
  registerDefaultWorkspaceConfigurationHandler(connection);
  registerDefaultServerRequestHandlers(connection);
  connection.listen();

  const params: InitializeParams = {
    processId: process.pid,
    rootUri: projectRoot,
    workspaceFolders: [{ uri: projectRoot, name: "rust" }],
    initializationOptions: {
      serverStatusNotification: "On",
      cargo: {
        autoreload: false,
        buildScripts: { enable: false }
      },
    },
    capabilities: CLIENT_CAPABILITIES,
  };

  let initialized = await connection.sendRequest("initialize", params as any) as InitializeResult;
  console.log(`rust analyzer initialized.`);

  connection.sendNotification("initialized", {});
  connection.sendNotification("textDocument/didOpen", {
    textDocument: {
      uri: rustUri,
      languageId: "rust",
      version: 1,
      text: code,
    },
  });
  return {
    connection: connection,
    process: cp,
    docUri: rustUri,
    docVersion: 1
  };
}
