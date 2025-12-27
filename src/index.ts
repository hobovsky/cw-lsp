import express from 'express';

import { getCompletions } from "./completions/index.js";
import { ensureLspSession } from './sessions/index.js';
import { getCallParamHints } from './callParamHints/index.js';

const app = express();
app.use(express.json());
const port = 3000;

app.get('/', (_req, res) => {
    console.info("GET Request received.");
    res.send('Hello, world!');
});

app.post('/init_lsp_session', async (req, res) => {
    console.info("init_session request received.");

    try {
      const lspSession = req.body as { language: string, userId: string, kataId: string, editorId: string };

      console.info(`Init request for session: ${JSON.stringify(lspSession)}`)

      let session = await ensureLspSession(lspSession);
      console.info(`LSP session initiated with process pid=${session.languageServer.process.pid ?? 'unknown' }`);
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

    const { code, lspSession, line, pos } = req.body as {
      code: string;
      lspSession: { language: string, userId: string, kataId: string, editorId: string };
      line: number;
      pos: number;
    };    

    let completions = await getCompletions(lspSession, code, lspSession.language, line, pos);
    let response = {
        completions
    }
    res.send(response);
});

app.post('/get_call_params', async (req, res) => {
    console.info("get_call_params request received.");

    const { code, lspSession, line, pos } = req.body as {
      code: string;
      lspSession: { language: string, userId: string, kataId: string, editorId: string };
      line: number;
      pos: number;
    };    

    let callParamHints = await getCallParamHints(lspSession, code, lspSession.language, line, pos);
    let response = {
        callParamHints
    }
    res.send(response);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
