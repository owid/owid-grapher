/**
 * A small localStorage ring buffer of recently selected palette items,
 * shown in the palette's empty-query state. Deliberately no frecency —
 * just the last selections, newest first.
 */

export interface RecentEntry {
    /** Palette item id: a command id, or `${sourceId}:${itemId}` for content */
    id: string
    title: string
    subtitle?: string
    /** "command" for registry commands, otherwise the search source id */
    kind: string
    /** Snapshot of the primary action for content items */
    to?: string
    href?: string
}

const STORAGE_KEY = "admin-command-palette-recents"
const MAX_RECENTS = 10

export function getRecents(): RecentEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed as RecentEntry[]
    } catch {
        return []
    }
}

export function recordRecent(entry: RecentEntry): void {
    try {
        const recents = [
            entry,
            ...getRecents().filter((recent) => recent.id !== entry.id),
        ].slice(0, MAX_RECENTS)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recents))
    } catch {
        // localStorage unavailable (private mode, quota) — recents are a
        // nice-to-have, fail silently
    }
}
