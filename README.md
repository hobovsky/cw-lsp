# `cw-lsp` - Language Server Integration for Codewars Code Editors

## Build

With `npm`:

```bash
npm ci
npm run build
```

With Docker:

```bash
docker build -t cw-lsp-app .
```

## Run

With `npm`:

```bash
# make sure that LSP_TEMPLATES_DIR is set
npm start
```

With Docker:

```bash
docker run -p 3000:3000 cw-lsp-app
```

## Usage

- Install Tampermonkey user script with client side implementation. It can be found in `client/cw-lsp.user.js`.
- Open kata trainer for Rust or Python. Other languages are currently not supported, but planned.
- Start typing code in the `Solution` editor. Use `Shift+Space` to trigger completion suggestions.

**NOTE:** Currently, changing trained language inside of kata trainer does not switch the language  the backing language server process, and LSP results returned by it do not match currently open language. Language server session needs to be reinitialized with `Ctrl+F5` after changing currently trained language.

**NOTE:** Currently, LSP process shuts down after 3 minutes of inactivity. It can be restarted by hard reload of the kata trainer.

**NOTE:** Startup of language servers for some languages can take some time. For Rust, it is ~10-20 seconds until it starts returning completion suggestions. Until the language server fully initializes, it may return no responses, or incomplete responses.
