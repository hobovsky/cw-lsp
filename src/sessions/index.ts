import { ChildProcess } from "node:child_process"
import { initRustLsp } from "./rust.js"
import { initPythonLsp } from "./python.js"
import { initJavaScriptLsp } from "./javascript.js"
import type { MessageConnection } from "vscode-jsonrpc"
import { initPhpLsp } from "./php.js"
import WebSocket  from "ws"

export type LspSessionKey = {
    userId: string,
    kataId: string,
    editorId: string,
    language: string
}

export type LanguageServerSession = {
    process: ChildProcess,
    connection: MessageConnection,
    docUri: string,
    docVersion: number,
    serverCapabilities?: unknown,
    killTimer?: NodeJS.Timeout
}

export type LspSession = {
    sessionKey: LspSessionKey,
    languageServer: LanguageServerSession
}

const sessions: Record<string, LspSession> = { };
const webSockets: Record<string, WebSocket> = { };

function stringifyKey(key: LspSessionKey): string {
    return `user-${key.userId}|kata-${key.kataId}|editor-${key.editorId}|lang-${key.language}`;
}

async function registerLspCallbacks(sessionKey: LspSessionKey) {

    let strKey = stringifyKey(sessionKey);
    let lspSession = sessions[strKey];
    let ws = webSockets[strKey];
    if(!lspSession || !ws) {
        console.info(`LSP session: ${!!lspSession}, web socket: ${!!ws}`);
        return;
    }

    let connection = lspSession.languageServer.connection;
    connection.onNotification((method, params) => {
        ws.send(JSON.stringify({method, params}));
    });
    console.info(`Registered LSP callbacks for ${strKey}.`);
}

export async function initLspSession(sessionKey: LspSessionKey, code: string): Promise<LspSession> {
    
    let existingSession = sessions[stringifyKey(sessionKey)];
    if(existingSession) {
        throw Error("Session already exists.");
    }

    let lspProcess: LanguageServerSession;
    switch(sessionKey.language) {
        case "rust":   lspProcess = await initRustLsp(code);   break;
        case "python": lspProcess = await initPythonLsp(code); break;
        case "php":    lspProcess = await initPhpLsp(code);    break;
        case "javascript": lspProcess = await initJavaScriptLsp(code); break;
        default: throw Error(`Language ${sessionKey.language} not supported.`);
    }
    lspProcess.killTimer = setTimeout(() => { 
        console.info(`LSP session for ${JSON.stringify(sessionKey)}, pid=${lspProcess.process.pid ?? 'unknown' } expired.`);
        lspProcess.process.kill(); 
    }, 3 * 60 * 1000);
    
    // TODO: store returned server capabilities
    let session = {
        languageServer: lspProcess,
        sessionKey
    }
    sessions[stringifyKey(sessionKey)] = session;
    await registerLspCallbacks(sessionKey);
    return session;
}

export function getLspSession(sessionKey: LspSessionKey): LspSession {
    let existingSession = sessions[stringifyKey(sessionKey)];
    if(!existingSession) {
        throw Error(`LSP not initialized for ${JSON.stringify(sessionKey)}.`)
    }
    
    return existingSession;
}

export async function registerWebSocket(sessionKey: LspSessionKey, ws: WebSocket) {

    let strKey = stringifyKey(sessionKey);
    let existing = webSockets[strKey];
    if(existing) {
        existing.close(1, "New socket requested for this session");
    }
    existing = ws;
    webSockets[strKey] = existing;
    await registerLspCallbacks(sessionKey);
}
