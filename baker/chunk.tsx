// Greedily concatenates items with separator in between, starting a new
// chunk whenever the next item would push it past maxChunkLength.
const packGreedily = (
    items: string[],
    maxChunkLength: number,
    separator: string
): string[] => {
    const chunks: string[] = []
    let current: string | null = null

    for (const item of items) {
        const next: string =
            current === null ? item : current + separator + item
        if (current !== null && next.length > maxChunkLength) {
            chunks.push(current)
            current = item
        } else {
            current = next
        }
    }

    if (current !== null) chunks.push(current)

    return chunks
}

// Splits a single word into pieces no longer than maxChunkLength without
// ever slicing a UTF-16 surrogate pair in half — a naive slice by code unit
// can cut an emoji apart and corrupt it into two invalid lone surrogates.
// Iterating a string with for...of yields whole Unicode code points.
const hardSplitWord = (word: string, maxChunkLength: number): string[] => {
    const pieces: string[] = []
    let current = ""

    for (const codePoint of word) {
        if (current && current.length + codePoint.length > maxChunkLength) {
            pieces.push(current)
            current = ""
        }
        current += codePoint
    }

    if (current) pieces.push(current)

    return pieces
}

// Words longer than maxChunkLength can't fit in any chunk, so they're
// hard-split into maxChunkLength-sized pieces.
export const chunkWords = (text: string, maxChunkLength: number): string[] => {
    const words = text
        .split(/\s+/)
        .filter(Boolean)
        .flatMap((word) =>
            word.length > maxChunkLength
                ? hardSplitWord(word, maxChunkLength)
                : word
        )

    return packGreedily(words, maxChunkLength, " ")
}

// Chunks a given bit of text into an array of fragments less than or equal to
// maxChunkLength in size. These chunks will honor sentence boundaries where
// possible.
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
        .filter(Boolean)

    return packGreedily(sentences, maxChunkLength, " ")
}

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
        .filter(Boolean)

    return packGreedily(paragraphs, maxChunkLength, "\n\n")
}
