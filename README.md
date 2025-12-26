# `cw-lsp` - Language Server Integration for Codewars Code Editors

## Client

To use code completion when training on a Codewars kata, only the client userscript is required:

- Install Tampermonkey user script with client side implementation. It can be found in `client/cw-lsp.user.js`. Read [TamperMonkey FAQ](https://www.tampermonkey.net/faq.php?locale=en) for help. Remember about enabling [userscript permissions and/or Development Mode](https://www.tampermonkey.net/faq.php?locale=en#Q209) if your browser requires it!
- Open kata trainer for PHP, Python, or Rust. Other languages are currently not supported, but planned.
- Start typing code in the `Solution` editor. Use `Shift+Space` to trigger completion suggestions.

**NOTE:** Currently, changing trained language inside of kata trainer does not switch the language of the backing language server process, and LSP results returned by it do not match currently open language. Language server session needs to be reinitialized with `Ctrl+F5` after changing currently trained language.

**NOTE:** Currently, backend LSP process shuts down after 3 minutes of inactivity. It can be restarted by hard reload of the kata trainer.

**NOTE (PHP):** Snippets must start with `<?php` directive. Old kata may be missing the directive in the solution setup, and it has to be added manually for LSP to work correctly.

**NOTE (Rust):** Startup of language servers for Rust can take some time. Usually, it is ~10-20 seconds until it starts returning completion suggestions. Until the language server fully initializes, it may return no responses, or incomplete responses. It can also feel sluggish and responses can be returned with a noticeable delay.

## Server

Server does not have to be run locally to use code completions. However, anyone who wants to tinker with backend or run it for development purposes, can follow instructions below.

### Build

With `npm`:

```bash
npm ci
npm run build
```

With Docker:

```bash
docker build -t cw-lsp-app .
```

### Run

With `npm`:

```bash
# make sure that LSP_TEMPLATES_DIR is set
npm start
```

With Docker:

```bash
docker run -p 3000:3000 cw-lsp-app
```
