/**
 * Resolve names an agent typed against the names a page actually has.
 *
 * Exact match first, then a normalised (case-insensitive) match, then give up:
 * an unresolved name comes back with up to `maxCandidates` substring matches so
 * the agent can pick, rather than us guessing. A synonym table would hide the
 * failure on the occasions the guess is wrong, and "Czech Republic" is exactly
 * the kind of name an agent produces confidently.
 */

export interface UnresolvedName {
    requested: string
    candidates: string[]
}

export interface NameMatchResult {
    /** in the order requested, using the page's spelling */
    resolved: string[]
    unresolved: UnresolvedName[]
}

export type Normalizer = (name: string) => string

export const caseInsensitive: Normalizer = (name) => name.trim().toLowerCase()

/** "line chart", "line_chart" and "LineChart" all collapse to "linechart" */
export const alphanumericInsensitive: Normalizer = (name) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, "")

export function matchNames(
    requested: string[],
    available: string[],
    {
        normalize = caseInsensitive,
        maxCandidates = 10,
    }: { normalize?: Normalizer; maxCandidates?: number } = {}
): NameMatchResult {
    const exact = new Set(available)
    const normalized = new Map<string, string>()
    for (const name of available) {
        const key = normalize(name)
        if (!normalized.has(key)) normalized.set(key, name)
    }

    const resolved: string[] = []
    const unresolved: UnresolvedName[] = []
    for (const name of requested) {
        if (exact.has(name)) {
            resolved.push(name)
            continue
        }
        const loose = normalized.get(normalize(name))
        if (loose !== undefined) {
            resolved.push(loose)
            continue
        }
        unresolved.push({
            requested: name,
            candidates: findCandidates(name, available, normalize).slice(
                0,
                maxCandidates
            ),
        })
    }
    return { resolved, unresolved }
}

function findCandidates(
    name: string,
    available: string[],
    normalize: Normalizer
): string[] {
    const needle = normalize(name)
    if (!needle) return []
    return available.filter((candidate) => {
        const hay = normalize(candidate)
        return hay.includes(needle) || needle.includes(hay)
    })
}

/**
 * One sentence per unresolved name, e.g.
 * `"Czech Republic" is not an entity on this chart. Did you mean: Czechia?`
 */
export function describeUnresolved(
    unresolved: UnresolvedName[],
    noun: string
): string {
    return unresolved
        .map(({ requested, candidates }) => {
            const base = `"${requested}" is not ${noun}.`
            return candidates.length
                ? `${base} Did you mean: ${candidates.join(", ")}?`
                : base
        })
        .join(" ")
}
