/**
 * A static embedding model run inside the function, for the charts'
 * vocabulary topic picks (vocabulary.ts). Every Workers AI call costs ~80–100
 * ms however small it is; a static model is a table with one vector per
 * token, so embedding a query is tokenizing it and averaging its tokens'
 * vectors: well under a millisecond.
 *
 * The model is potion-base-8M (model2vec, distilled from bge-base-en-v1.5),
 * English, 256 dimensions. Its float table is 30 MB, too big for the
 * functions bundle, so it's fetched once per isolate from our copy of the
 * Hugging Face files, pinned to their revision.
 *
 * This reimplements model2vec's encoding: the BERT tokenizer (lowercase,
 * accents stripped, split on whitespace and punctuation, WordPiece), unknown
 * words dropped, the mean of the tokens' vectors.
 */

const MODEL_BASE =
    "https://files.ourworldindata.org/search/potion-base-8M/bf8b056651a2c21b8d2565580b8569da283cab23"

// WordPiece gives up on longer words, as the original does
const MAX_WORD_CHARS = 100

export interface StaticModel {
    vocab: Map<string, number>
    vectors: Float32Array
    dims: number
}

const isPunctuation = (char: string): boolean => {
    const code = char.codePointAt(0)!
    return (
        (code >= 33 && code <= 47) ||
        (code >= 58 && code <= 64) ||
        (code >= 91 && code <= 96) ||
        (code >= 123 && code <= 126) ||
        /\p{P}/u.test(char)
    )
}

const isCjk = (code: number): boolean =>
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x20000 && code <= 0x2a6df) ||
    (code >= 0x2a700 && code <= 0x2b73f) ||
    (code >= 0x2b740 && code <= 0x2b81f) ||
    (code >= 0x2b820 && code <= 0x2ceaf) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0x2f800 && code <= 0x2fa1f)

/** The BERT normalizer and pre-tokenizer: the words WordPiece splits. */
export function bertWords(text: string): string[] {
    let cleaned = ""
    for (const char of text) {
        const code = char.codePointAt(0)!
        const isSpace = char === "\t" || char === "\n" || char === "\r"
        if (code === 0 || code === 0xfffd || (!isSpace && /\p{C}/u.test(char)))
            continue
        if (isSpace || /\p{Zs}/u.test(char)) cleaned += " "
        else if (isCjk(code)) cleaned += ` ${char} `
        else cleaned += char
    }
    const normalized = cleaned
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Mn}/gu, "")
    const words: string[] = []
    for (const word of normalized.split(/\s+/)) {
        let current = ""
        for (const char of word) {
            if (isPunctuation(char)) {
                if (current) words.push(current)
                words.push(char)
                current = ""
            } else current += char
        }
        if (current) words.push(current)
    }
    return words
}

/** Greedy longest-match WordPiece; undefined for a word it can't split. */
function wordPiece(
    word: string,
    vocab: Map<string, number>
): number[] | undefined {
    const chars = Array.from(word)
    if (chars.length > MAX_WORD_CHARS) return undefined
    const ids: number[] = []
    let start = 0
    while (start < chars.length) {
        let end = chars.length
        let found: number | undefined
        while (start < end) {
            const piece =
                (start > 0 ? "##" : "") + chars.slice(start, end).join("")
            found = vocab.get(piece)
            if (found !== undefined) break
            end--
        }
        if (found === undefined) return undefined
        ids.push(found)
        start = end
    }
    return ids
}

/** Token ids, with words the vocabulary can't split dropped. */
export const tokenIds = (text: string, vocab: Map<string, number>): number[] =>
    bertWords(text).flatMap((word) => wordPiece(word, vocab) ?? [])

/** The mean of the text's token vectors; all zeros for no known token. */
export function embedStatic(model: StaticModel, text: string): number[] {
    const sum = new Array<number>(model.dims).fill(0)
    const ids = tokenIds(text, model.vocab)
    for (const id of ids) {
        const offset = id * model.dims
        for (let d = 0; d < model.dims; d++) sum[d] += model.vectors[offset + d]
    }
    return ids.length > 0 ? sum.map((x) => x / ids.length) : sum
}

/** The one F32 tensor of a safetensors file. */
export function parseSafetensors(buffer: ArrayBuffer): {
    vectors: Float32Array
    rows: number
    dims: number
} {
    const headerLength = Number(new DataView(buffer).getBigUint64(0, true))
    const header = JSON.parse(
        new TextDecoder().decode(new Uint8Array(buffer, 8, headerLength))
    ) as Record<
        string,
        { dtype?: string; shape?: number[]; data_offsets?: number[] }
    >
    const tensors = Object.entries(header).filter(([k]) => k !== "__metadata__")
    const [, tensor] = tensors[0] ?? []
    if (
        tensors.length !== 1 ||
        tensor?.dtype !== "F32" ||
        tensor.shape?.length !== 2 ||
        tensor.data_offsets?.length !== 2
    )
        throw new Error("static model has an unexpected tensor layout")
    const [rows, dims] = tensor.shape
    const start = 8 + headerLength + tensor.data_offsets[0]
    // Float32Array needs a 4-byte-aligned offset
    const vectors =
        start % 4 === 0
            ? new Float32Array(buffer, start, rows * dims)
            : new Float32Array(buffer.slice(start, start + rows * dims * 4))
    return { vectors, rows, dims }
}

const fetchModelFile = async (name: string): Promise<Response> => {
    const response = await fetch(`${MODEL_BASE}/${name}`, {
        cf: { cacheTtl: 86400, cacheEverything: true },
    })
    if (!response.ok)
        throw new Error(`static model ${name} fetch failed: ${response.status}`)
    return response
}

/** One vector per text, in order; the first call loads the model. */
export async function embedStaticTexts(texts: string[]): Promise<number[][]> {
    const loaded = await loadStaticModel()
    return texts.map((text) => embedStatic(loaded, text))
}

let model: Promise<StaticModel> | undefined

/** Per isolate: the files are pinned to a revision, so they never change. */
export function loadStaticModel(): Promise<StaticModel> {
    model ??= Promise.all([
        fetchModelFile("model.safetensors").then((r) => r.arrayBuffer()),
        fetchModelFile("tokenizer.json").then((r) =>
            r.json<{ model?: { vocab?: unknown } }>()
        ),
    ])
        .then(([weights, tokenizer]) => {
            const { vectors, rows, dims } = parseSafetensors(weights)
            const vocab = tokenizer.model?.vocab
            if (typeof vocab !== "object" || vocab === null)
                throw new Error("static model tokenizer has no vocabulary")
            const entries = Object.entries(vocab) as [string, number][]
            if (entries.length !== rows)
                throw new Error("static model vocabulary and table disagree")
            return { vocab: new Map(entries), vectors, dims }
        })
        .catch((error) => {
            model = undefined // retry on the next request
            throw error
        })
    return model
}
