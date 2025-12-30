import express from 'express';

import { getCompletions } from "./completions/index.js";
import { getLspSession, initLspSession, registerWebSocket, type LspSessionKey } from './sessions/index.js';
import { getCallParamHints } from './callParamHints/index.js';

import expressWs from 'express-ws';
import { updateDoc } from './updates/index.js';
import type { CodeMirrorChange } from './cmTypes.js';

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
      const lspSession = req.body as { 
        language: string, 
        userId: string, 
        kataId: string, 
        editorId: string
      };
      const initialCode = req.body.initialCode;

      console.info(`Init request for session: ${JSON.stringify(lspSession)}`)

      let session = await initLspSession(lspSession, initialCode);
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
      const {lspSession, updatedContent, changes} = req.body as { 
        lspSession: LspSessionKey, 
        updatedContent?: string,
        changes?: CodeMirrorChange[]
      };

      if(updatedContent) {
        await updateDoc(lspSession, updatedContent);
      } else if (changes) {
        await updateDoc(lspSession, changes);
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

    const { lspSession, line, pos } = req.body as {
      lspSession: { language: string, userId: string, kataId: string, editorId: string };
      line: number;
      pos: number;
    };    

    let completions = await getCompletions(lspSession, line, pos);
    let response = {
        completions
    }
    res.send(response);
});

app.post('/get_call_params', async (req, res) => {
    console.info("get_call_params request received.");

    const { lspSession, line, pos } = req.body as {
      lspSession: { language: string, userId: string, kataId: string, editorId: string };
      line: number;
      pos: number;
    };    

    let callParamHints = await getCallParamHints(lspSession, line, pos);
    let response = {
        callParamHints
    }
    res.send(response);
});

app.ws('/lsp-ws', async (ws, req) => {

  const url = new URL(req.url!, 'http://localhost');
  const params = url.searchParams;

  let userId = params.get("userId");
  let kataId = params.get("kataId");
  let editorId = params.get("editorId");
  let language = params.get("language");

  if(!userId || !kataId || !editorId || !language) {
    console.info(`Incomplete WebSocket connection request for userId=${userId} kataId=${kataId} editorId=${editorId} language=${language}`);
    return;
  }

  console.info(`WebSocket connection requested for userId=${userId} kataId=${kataId} editorId=${editorId} language=${language}`);
  await registerWebSocket({
    userId, kataId, editorId, language
  }, ws);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
