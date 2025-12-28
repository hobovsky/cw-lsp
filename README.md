# `cw-lsp` - Language Server Integration for Codewars Code Editors

`cw-lsp` is a Tampermonkey user script which turns Codewars code editors into Language Server Protocol clients and enriches them with some basic IDE-like functionality. It currently supports:

- Language Server Protocol features: code completions, callable signatures, code diagnostics;
- Languages: JavaScript, Python, PHP, Rust;
- Codewars editors: currently, the only supported editor is the Solution editor in kata trainer.


## Client

To use code completion when training on a Codewars kata, only the client userscript is required:

- Install Tampermonkey user script with client side implementation. It can be found in `client/cw-lsp.user.js`. Read [TamperMonkey FAQ](https://www.tampermonkey.net/faq.php?locale=en) for help. Remember about enabling [userscript permissions and/or Development Mode](https://www.tampermonkey.net/faq.php?locale=en#Q209) if your browser requires it!
- Open kata trainer for one of supported languages.
- Start typing code in the `Solution` editor. Use one of following key combinations:
  - `Shift-Space` to trigger completion suggestions.
  - `Alt-A` to trigger signature hints.

### Known issues

- Currently, changing trained language inside of kata trainer does not switch the language of the backing language server process, and LSP results returned by it do not match currently open language. Language server session needs to be reinitialized with `Ctrl+F5` after changing currently trained language.
- Currently, backend LSP process shuts down after 3 minutes of inactivity. It can be restarted by hard reload of the kata trainer.
- **PHP:** Snippets must start with `<?php` directive. Old kata may be missing the directive in the solution setup, and it has to be added manually for LSP to work correctly.
- **Rust:** Startup of language servers for Rust can take some time. Usually, it is ~10-20 seconds until it starts returning completion suggestions. Until the language server fully initializes, it may return no responses, or incomplete responses. It can also feel sluggish and responses can be returned with a noticeable delay.


## Server

Server does not have to be run locally to use `cw-lsp`. Client script is configured to use a publicly available service. However, anyone who wants to tinker with backend or run it for development purposes, can follow instructions below.

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

## Guarantees

`cw-lsp` is an experimental tool under active development.

- Features, behavior, and supported languages may change at any time.
- Backward compatibility is not guaranteed.
- The publicly available server is provided on a best-effort basis, has limited capacity, and may be unavailable, slow, or reset without notice.
- No uptime, performance, or data persistence guarantees are provided.

Use the tool with the expectation that occasional breakage or downtime may occur.
