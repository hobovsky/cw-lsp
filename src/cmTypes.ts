export type CodeMirrorPosition = {
    line: number,
    ch: number
}

export type CodeMirrorChange = {
    from: CodeMirrorPosition,
    to: CodeMirrorPosition,
    text: string[],
    removed: string,
    origin?: string
}
