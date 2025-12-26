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

import { pathToFileURL } from "node:url";
import path from "node:path";

const TEMPLATES = process.env.LSP_TEMPLATES_DIR;
if(!TEMPLATES)
  throw Error("LSP_TEMPLATES_DIR not set");

const rustProjectRoot = path.join(TEMPLATES, "rust");
const rustFile = path.join(rustProjectRoot, "src", "main.rs");

const rustUri = pathToFileURL(rustFile).toString();
const projectRoot = pathToFileURL(rustProjectRoot).toString();

export async function initRustLsp(): Promise<LanguageServerSession> {

  const cp = spawn("rust-analyzer");
  const reader = new StreamMessageReader(cp.stdout);
  const writer = new StreamMessageWriter(cp.stdin);

  const connection = createMessageConnection(reader, writer);

  cp.stderr.on("data", (d) => console.error("RA stderr:", d.toString()));
  connection.onNotification((method, params) => {
    // Helpful to see everything the server emits while debugging.
    console.log("rust LSP notification:", method, JSON.stringify(params, null, 2));
  });
  connection.onNotification("window/logMessage", (m: unknown) =>
    console.log("rust LSP log:", JSON.stringify(m, null, 2))
  );
  connection.onNotification("window/showMessage", (m: unknown) =>
    console.warn("rust LSP msg:", JSON.stringify(m, null, 2))
  );
  
  // Wait until rust-analyzer announces it is ready before requesting completion.
  const ready = new Promise<void>((resolve) => {
    connection.onNotification("rust-analyzer/status", (p: { status: string }) => {
      console.log("Status:", p.status);
      if (p.status === "ready") resolve();
    });
  });

  connection.listen();

  const params: InitializeParams = {
    processId: process.pid,
    rootUri: projectRoot,
    workspaceFolders: [{ uri: projectRoot, name: "rust" }],
    initializationOptions: {
      serverStatusNotification: "On",
    },
    capabilities: {
      textDocument: {
        completion: { completionItem: { snippetSupport: false } },
      },
    },
  };

  const result = (await connection.sendRequest(
    "initialize",
    params
  )) as InitializeResult;

  console.log("Rust LSP initialized. Server capabilities received.");

  connection.sendNotification("initialized", {});
  // Proceed after ready, or after a timeout so we still see what happens.
  await Promise.race([
    ready,
    new Promise<void>((resolve) =>
      setTimeout(() => {
        console.warn("Ready notification timed out; continuing anyway.");
        resolve();
      }, 5000)
    ),
  ]);

  connection.sendNotification("textDocument/didOpen", {
    textDocument: {
      uri: rustUri,
      languageId: "rust",
      version: 1,
      text: "",
    },
  });
  return {
    connection: connection,
    process: cp,
    docUri: rustUri,
    docVersion: 1
  };
}
