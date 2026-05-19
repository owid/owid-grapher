import * as fs from "node:fs"
import { Candidate, OverridesFile } from "./types.js"

const toPath = (urlOrPath: string): string => {
    try {
        return new URL(urlOrPath).pathname
    } catch {
        return urlOrPath.startsWith("/") ? urlOrPath : `/${urlOrPath}`
    }
}

export const loadOverrides = (path: string): OverridesFile => {
    if (!fs.existsSync(path)) return {}
    return JSON.parse(fs.readFileSync(path, "utf-8")) as OverridesFile
}

export const applyExcludes = (
    candidates: Candidate[],
    excludes: string[] | undefined
): Candidate[] => {
    if (!excludes || excludes.length === 0) return candidates
    const set = new Set(excludes.map(toPath))
    return candidates.filter((c) => !set.has(toPath(c.url)))
}

export const markPins = (
    candidates: Candidate[],
    pins: string[] | undefined
): Candidate[] => {
    if (!pins || pins.length === 0) return candidates
    const pinPaths = pins.map(toPath)
    const order = new Map(pinPaths.map((p, i) => [p, i]))
    const present = new Set(candidates.map((c) => toPath(c.url)))
    const missing = pinPaths.filter((p) => !present.has(p))
    if (missing.length > 0)
        // eslint-disable-next-line no-console
        console.warn(
            `[relatedContent] Pin paths not in candidate pool (will be skipped): ${missing.join(", ")}`
        )
    return candidates.map((c) =>
        order.has(toPath(c.url)) ? { ...c, isPinned: true } : c
    )
}

// Pre-index the pins array (keyed by normalized path) so sort comparators
// can do O(1) lookups rather than rescanning the pins per candidate pair.
// Consumers should also normalize via `pinOrderKey` before lookup.
export const buildPinOrderMap = (
    pins: string[] | undefined
): Map<string, number> => {
    const map = new Map<string, number>()
    if (!pins) return map
    pins.forEach((pin, i) => map.set(toPath(pin), i))
    return map
}

export const pinOrderKey = (url: string): string => toPath(url)
