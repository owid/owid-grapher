import chunk from "chunk-text"

export const chunkWords = (text: string, maxChunkLength: number): string[] =>
    chunk(text, maxChunkLength)

export const chunkSentences = (
    text: string,
    maxChunkLength: number
): string[] => {
    // See https://stackoverflow.com/a/25736082/1983739
    // Not perfect, just works in most cases
    const sentenceRegex = /(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\n)\s/g
    const sentences = text
        .split(sentenceRegex)
        .flatMap((s) =>
            s.length > maxChunkLength ? chunkWords(s, maxChunkLength) : s
        )

        .map((s) => s.trim())
        .filter((s) => s)
        .reverse() as string[]

    const chunks = []
    let chunk = sentences.pop()
    if (!chunk) return []

    while (true) {
        const sentence = sentences.pop()
        if (!sentence) {
            chunks.push(chunk)
            break
        } else {
            const nextChunk: string = chunk + " " + sentence
            if (nextChunk.length > maxChunkLength) {
                chunks.push(chunk)
                chunk = sentence
            } else chunk = nextChunk
        }
    }

    return chunks
}
// Chunks a given bit of text into an array of fragments less than or equal to maxChunkLength in size
// These chunks will honor sentence boundaries where possible

export const chunkParagraphs = (
    text: string,
    maxChunkLength: number
): string[] => {
    const paragraphs = text
        .split("\n\n")
        .flatMap((p) =>
            p.length > maxChunkLength ? chunkSentences(p, maxChunkLength) : p
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
            } else chunk = nextChunk
        }
    }

    return chunks
}
