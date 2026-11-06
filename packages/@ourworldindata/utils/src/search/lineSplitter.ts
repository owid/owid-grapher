export interface LineSplitter {
    push: (chunk: string) => void
    // Emits the last line, which has no trailing newline
    flush: () => void
    // Drops a partial line, e.g. when the producer starts over
    reset: () => void
}

/**
 * Splits streamed text (e.g. newline-delimited JSON) into complete lines,
 * holding back a partial line until the rest of it arrives.
 */
export function createLineSplitter(
    onLine: (line: string) => void
): LineSplitter {
    let buffer = ""
    return {
        push: (chunk) => {
            const lines = (buffer + chunk).split("\n")
            buffer = lines.pop() ?? ""
            lines.forEach(onLine)
        },
        flush: () => {
            if (buffer) onLine(buffer)
            buffer = ""
        },
        reset: () => {
            buffer = ""
        },
    }
}
