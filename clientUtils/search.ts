import { flatten } from "clientUtils/Util"
import chunk from "chunk-text"
import { fromString } from "html-to-text"

export function htmlToPlaintext(html: string): string {
    return fromString(html, {
        tables: true,
        ignoreHref: true,
        wordwrap: false,
        uppercaseHeadings: false,
        ignoreImage: true,
    })
}

export function chunkWords(text: string, maxChunkLength: number): string[] {
    return chunk(text, maxChunkLength)
}

export function chunkSentences(text: string, maxChunkLength: number): string[] {
    // See https://stackoverflow.com/a/25736082/1983739
    // Not perfect, just works in most cases
    const sentenceRegex = /(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\n)\s/g
    const sentences = flatten(
        text
            .split(sentenceRegex)
            .map((s) =>
                s.length > maxChunkLength ? chunkWords(s, maxChunkLength) : s
            )
    )
        .map((s) => s.trim())
        .filter((s) => s)
        .reverse() as string[]

    const chunks = []
    let chunk = sentences.pop()
    if (!chunk) return []

    while (true) {
        const s = sentences.pop()
        if (!s) {
            chunks.push(chunk)
            break
        } else {
            const nextChunk: string = chunk + " " + s
            if (nextChunk.length > maxChunkLength) {
                chunks.push(chunk)
                chunk = s
            } else {
                chunk = nextChunk
            }
        }
    }

    return chunks
}

// Chunks a given bit of text into an array of fragments less than or equal to maxChunkLength in size
// These chunks will honor sentence boundaries where possible
export function chunkParagraphs(
    text: string,
    maxChunkLength: number
): string[] {
    const paragraphs = flatten(
        text
            .split("\n\n")
            .map((p) =>
                p.length > maxChunkLength
                    ? chunkSentences(p, maxChunkLength)
                    : p
            )
    )
        .map((p) => p.trim())
        .filter((p) => p)
        .reverse() as string[]

    const chunks = []
    let chunk = paragraphs.pop()
    if (!chunk) return []

    while (true) {
        const p = paragraphs.pop()
        if (!p) {
            chunks.push(chunk)
            break
        } else {
            const nextChunk: string = chunk + "\n\n" + p
            if (nextChunk.length > maxChunkLength) {
                chunks.push(chunk)
                chunk = p
            } else {
                chunk = nextChunk
            }
        }
    }

    return chunks
}
