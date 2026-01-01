import { ChildProcess } from "node:child_process"
import { initRustLsp } from "./rust.js"
import { initPythonLsp } from "./python.js"
import { initJavaScriptLsp } from "./javascript.js"
import type { MessageConnection } from "vscode-jsonrpc"
import { initPhpLsp } from "./php.js"
import WebSocket  from "ws"

// TODO: rename to LspSessionInfo
export type LspSessionInfo = {
    userId: string,
    kataId: string,
    trainerSessionId: string,
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
    sessionInfo: LspSessionInfo,
    languageServer: LanguageServerSession
}

const sessions: Record<string, LspSession> = { };
const webSockets: Record<string, WebSocket> = { };

async function registerLspCallbacks(trainerSessionId: string) {

    let lspSession = sessions[trainerSessionId];
    let ws = webSockets[trainerSessionId];
    if(!lspSession || !ws) {
        console.info(`LSP session: ${!!lspSession}, web socket: ${!!ws}`);
        return;
    }

    let connection = lspSession.languageServer.connection;
    connection.onNotification((method, params) => {
        ws.send(JSON.stringify({method, params}));
    });
    console.info(`Registered LSP callbacks for ${trainerSessionId}.`);
}

export async function initLspSession(trainerSessionId: string, sessionInfo: LspSessionInfo, code: string): Promise<LspSession> {
    
    let existingSession = sessions[trainerSessionId];
    if(existingSession) {
        throw Error("Session already exists.");
    }

    let lspProcess: LanguageServerSession;
    switch(sessionInfo.language) {
        case "rust":   lspProcess = await initRustLsp(code);   break;
        case "python": lspProcess = await initPythonLsp(code); break;
        case "php":    lspProcess = await initPhpLsp(code);    break;
        case "javascript": lspProcess = await initJavaScriptLsp(code); break;
        default: throw Error(`Language ${sessionInfo.language} not supported.`);
    }
    lspProcess.killTimer = setTimeout(() => { 
        console.info(`LSP session for ${JSON.stringify(sessionInfo)}, pid=${lspProcess.process.pid ?? 'unknown' } expired.`);
        lspProcess.process.kill(); 
    }, 10 * 60 * 1000);
    
    // TODO: store returned server capabilities
    let session = {
        languageServer: lspProcess,
        sessionInfo
    }
    sessions[trainerSessionId] = session;
    await registerLspCallbacks(trainerSessionId);
    return session;
}

export function getLspSession(trainerSessionId: string): LspSession {
    let existingSession = sessions[trainerSessionId];
    if(!existingSession) {
        throw Error(`LSP not initialized for ${trainerSessionId}.`)
    }
    
    return existingSession;
}

export async function registerWebSocket(trainerSessionId: string, ws: WebSocket) {

    let existing = webSockets[trainerSessionId];
    if(existing) {
        existing.close(1, "New socket requested for this session");
    }
    webSockets[trainerSessionId] = ws;
    await registerLspCallbacks(trainerSessionId);
}
