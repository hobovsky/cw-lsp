import express from 'express';

import { getCompletions, resolveCompletion } from "./completions/index.js";
import { initLspSession, registerWebSocket, type LspSessionInfo } from './sessions/index.js';
import { getCallParamHints } from './callParamHints/index.js';

import expressWs from 'express-ws';
import { updateDoc } from './updates/index.js';
import type { CodeMirrorChange } from './cmTypes.js';
import type { CompletionItem } from 'vscode-languageserver-protocol';

type LspServiceResponse<T> = {
  trainerSessionId: string,
  data: T
}

const { app } = expressWs(express());

app.use(express.json());
const port = 3000;

app.get('/', (_req, res) => {
    console.info("GET Request received.");
    res.send('Hello, world!');
});

app.post('/init_lsp_session', async (req, res) => {
    console.info("init_session request received.");

    try {
      const requestParams = req.body as LspServiceResponse<{
          sessionInfo: LspSessionInfo,
          initialCode: string
      }>;
      
      console.info(`Init request for session: ${requestParams.trainerSessionId}`)

      let session = await initLspSession(
        requestParams.trainerSessionId, 
        requestParams.data.sessionInfo, 
        requestParams.data.initialCode);

      console.info(`LSP session initiated with process pid=${session.languageServer.process.pid ?? 'unknown' }`);
      let response = { ok: true, serverCapabilities: session.languageServer.serverCapabilities };
      res.send(response);

    } catch(e: unknown) {

      let message = "Unknown error.";
      if(typeof e === "string") {
        message = e;
      } else if (e instanceof Error) {
        message = e.message;
      }

      res.status(500).send({ ok: false, message  })
    }
});

app.post('/update_doc', async (req, res) => {
    console.info("update_doc request received.");

    try {
      const requestParams = req.body as LspServiceResponse<{ 
        updatedContent?: string,
        changes?: CodeMirrorChange[]
      }>;

      let trainerSessionId = requestParams.trainerSessionId;
      let { updatedContent, changes } = requestParams.data;

      if(updatedContent) {
        await updateDoc(trainerSessionId, updatedContent);
      } else if (changes) {
        await updateDoc(trainerSessionId, changes);
      }

      let response = { ok: true };
      res.send(response);

    } catch(e: unknown) {

      let message = "Unknown error.";
      if(typeof e === "string") {
        message = e;
      } else if (e instanceof Error) {
        message = e.message;
      }

      res.status(500).send({ ok: false, message  })
    }
});

app.post('/get_completions', async (req, res) => {
    console.info("get_compleitons request received.");

    const requestParams = req.body as LspServiceResponse<{
      line: number;
      pos: number;
    }>;    

    let { line, pos } = requestParams.data;
    let completions = await getCompletions(requestParams.trainerSessionId, line, pos);
    let response = {
        completions
    }
    res.send(response);
});

app.post('/resolve_completion', async (req, res) => {
    console.info("resolve_compleiton request received.");

    const requestParams = req.body as LspServiceResponse<{
      completionItem: CompletionItem;
    }>;    

    let resolvedCompletion = await resolveCompletion(requestParams.trainerSessionId, requestParams.data.completionItem);
    let response = {
        resolvedCompletion
    }
    res.send(response);
});

app.post('/get_call_params', async (req, res) => {
    console.info("get_call_params request received.");

    const requestParams = req.body as LspServiceResponse<{
      line: number,
      pos: number
    }>;    

    const { line, pos } = requestParams.data;
    let callParamHints = await getCallParamHints(requestParams.trainerSessionId, line, pos);
    let response = {
        callParamHints
    }
    res.send(response);
});

app.ws('/lsp-ws', async (ws, req) => {

  const url = new URL(req.url!, 'http://localhost');
  const params = url.searchParams;

  let trainerSessionId = params.get("trainerSessionId");
  
  if(!trainerSessionId) {
    console.info(`Missing trainerSessionId in WebSocket connection request.`);
    return;
  }

  console.info(`WebSocket connection requested for trainerSessionId=${trainerSessionId}`);
  await registerWebSocket(trainerSessionId, ws);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
