import { CompletionItemKind, DiagnosticTag, InsertTextMode, MarkupKind, PositionEncodingKind, SymbolKind, type ClientCapabilities } from "vscode-languageserver-protocol";
import type { MessageConnection } from "vscode-jsonrpc";

// We are going to be very explicit about capabilities,
// so it will be hopefully easier for future maintainers
// to see what was considered at all, and what was missed or
// added to LSP later.

const ALL_COMPLETION_ITEMS = [
    CompletionItemKind.Text,
    CompletionItemKind.Method,
    CompletionItemKind.Function,
    CompletionItemKind.Constructor,
    CompletionItemKind.Field,
    CompletionItemKind.Variable,
    CompletionItemKind.Class,
    CompletionItemKind.Interface,
    CompletionItemKind.Module,
    CompletionItemKind.Property,
    CompletionItemKind.Unit,
    CompletionItemKind.Value,
    CompletionItemKind.Enum,
    CompletionItemKind.Keyword,
    CompletionItemKind.Snippet,
    CompletionItemKind.Color,
    CompletionItemKind.File,
    CompletionItemKind.Reference,
    CompletionItemKind.Folder,
    CompletionItemKind.EnumMember,
    CompletionItemKind.Constant,
    CompletionItemKind.Struct,
    CompletionItemKind.Event,
    CompletionItemKind.Operator,
    CompletionItemKind.TypeParameter,
];

export const CLIENT_CAPABILITIES: ClientCapabilities = {
    
    general: {
        // staleRequestSupport: undefined,
        // regularExpressions: undefined,
        markdown: { parser: "marked" },
        positionEncodings: [ PositionEncodingKind.UTF16 ]
    },
    textDocument: {
        synchronization: {
            didSave: false,
            dynamicRegistration: false,
            willSave: false,
            willSaveWaitUntil: false
        },
        completion: {
            dynamicRegistration: false,
            completionItem: {
                commitCharactersSupport: false, // TODO: add support
                deprecatedSupport: false,
                documentationFormat: [ "markdown", "plaintext" ],
                insertReplaceSupport: false,
                insertTextModeSupport: { valueSet: [ InsertTextMode.adjustIndentation, InsertTextMode.asIs ] },
                labelDetailsSupport: true,
                preselectSupport: false, // TODO: add support
                // resolveSupport: undefined,
                snippetSupport: false, // TODO: add support
                tagSupport: { valueSet: [] } // TODO: add support
            },
            completionItemKind: { valueSet: ALL_COMPLETION_ITEMS },
            // completionList: undefined,
            contextSupport: false,
            insertTextMode: InsertTextMode.asIs,
        },

        // diagnostic: undefined, // TODO: add support
        publishDiagnostics: {
            codeDescriptionSupport: false,
            dataSupport: false,
            relatedInformation: false,
            tagSupport: { valueSet: [ DiagnosticTag.Deprecated, DiagnosticTag.Unnecessary ] },
            versionSupport: false
        },
        signatureHelp: {
            contextSupport: false,
            dynamicRegistration: false,
            signatureInformation: {
                activeParameterSupport: false, // TODO: add support
                documentationFormat: [ MarkupKind.PlainText, MarkupKind.Markdown ],
                parameterInformation: {
                    labelOffsetSupport: false
                }
            }
        },

        // callHierarchy: undefined,
        // codeAction: undefined,
        // codeLens: undefined,
        // colorProvider: undefined,
        // declaration: undefined,
        // definition: undefined,
        // documentHighlight: undefined,
        // documentLink: undefined,
        // documentSymbol: undefined,
        // foldingRange: undefined,
        // formatting: undefined,
        // hover: undefined, // TODO: add support
        // implementation: undefined,
        // inlayHint: undefined,
        // inlineCompletion: undefined,
        // inlineValue: undefined,
        // linkedEditingRange: undefined,
        // moniker: undefined,
        // onTypeFormatting: undefined,
        // rangeFormatting: undefined,
        // references: undefined,
        // rename: undefined,
        // selectionRange: undefined,
        // semanticTokens: undefined,
        // typeDefinition: undefined,
        // typeHierarchy: undefined
    },

    workspace: {
        workspaceFolders: false,
        configuration: true,
        // didChangeConfiguration: undefined,
        // applyEdit: undefined,
        // codeLens: undefined,
        // diagnostics: undefined,
        // didChangeConfiguration: undefined,
        // didChangeWatchedFiles: undefined,
        // executeCommand: undefined,
        // fileOperations: undefined,
        // foldingRange: undefined,
        // inlayHint: undefined,
        // inlineValue: undefined,
        // semanticTokens: undefined,
        // symbol: undefined,
        // workspaceEdit: undefined
    },
    
    // These are not supported now, but might be in the future
    // window: {
    //     workDoneProgress: false,
    //     showMessage: { messageActionItem: { additionalPropertiesSupport: false } },
    //     showDocument: { support: false}
    // },

    // Support for capabilities below is not planned
    // experimental: undefined,
    // notebookDocument: undefined,
}

export function registerDefaultWorkspaceConfigurationHandler(connection: MessageConnection) {
    connection.onRequest("workspace/configuration", (params: any) => {
        const items = (params?.items ?? []) as unknown[];
        return items.map(() => null);
    });
}

export function registerDefaultServerRequestHandlers(connection: MessageConnection) {

    // Some servers send these requests even if we advertise `dynamicRegistration: false`.
    // Provide dummy handlers to avoid hangs; fill in proper behavior later as needed.
    // TODO: implement these handlers properly (or narrow them per language server).

    connection.onRequest("client/registerCapability", (params: any) => {
        console.info("Dummy handler invoked: client/registerCapability", params);
        return null;
    });

    connection.onRequest("client/unregisterCapability", (params: any) => {
        console.info("Dummy handler invoked: client/unregisterCapability", params);
        return null;
    });

    connection.onRequest("window/workDoneProgress/create", (params: any) => {
        console.info("Dummy handler invoked: window/workDoneProgress/create", params);
        return null;
    });

    connection.onRequest("window/showMessageRequest", (params: any) => {
        console.info("Dummy handler invoked: window/showMessageRequest", params);
        return null;
    });

    connection.onRequest("workspace/workspaceFolders", (params: any) => {
        console.info("Dummy handler invoked: workspace/workspaceFolders", params);
        return [];
    });
}
