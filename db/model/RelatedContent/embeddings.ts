import * as fs from "node:fs"

export type EmbeddingsCache = Map<string, number[]>

export const loadEmbeddingsCache = (path: string): EmbeddingsCache => {
    if (!fs.existsSync(path)) return new Map()
    const raw = JSON.parse(fs.readFileSync(path, "utf-8")) as Record<
        string,
        number[]
    >
    return new Map(Object.entries(raw))
}

export const writeEmbeddingsCache = (
    path: string,
    cache: EmbeddingsCache
): void => {
    const obj: Record<string, number[]> = {}
    for (const [k, v] of cache.entries()) obj[k] = v
    fs.writeFileSync(path, JSON.stringify(obj))
}

export const cosineSimilarity = (a: number[], b: number[]): number => {
    if (a.length !== b.length) return 0
    let dot = 0
    let na = 0
    let nb = 0
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i]
        na += a[i] * a[i]
        nb += b[i] * b[i]
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb)
    if (denom === 0) return 0
    return dot / denom
}
