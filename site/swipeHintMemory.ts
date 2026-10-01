/**
 * Per-browser memory for the swipe nudge, so it's shown to people who might
 * not know they can swipe — and not nagged at people who know and don't want to.
 *
 * The rules:
 *   - never swiped, never seen the nudge  → show it
 *   - has swiped, ever                    → never again (they know)
 *   - seen it, not swiped, within N days  → don't (don't nag)
 *   - seen it, not swiped, after N days   → show it again, up to MAX_SHOWS
 *     in total — past that, they've seen it enough times to have decided
 *
 * localStorage, not a cookie: nothing here needs to reach a server. Whether a
 * functional flag like this falls under the consent banner is a question for
 * whoever owns that policy — it records no personal data and no analytics.
 */

const KEY = "owid-data-perspectives-swipe-hint"
const MAX_SHOWS = 3
const DAY_MS = 24 * 60 * 60 * 1000

interface HintMemory {
    shows: number
    lastShownAt?: number
    hasSwiped?: boolean
}

function read(): HintMemory {
    try {
        const raw = localStorage.getItem(KEY)
        if (raw) return { shows: 0, ...JSON.parse(raw) }
    } catch {
        // Unavailable (private mode, blocked site data) or corrupt: treat as new.
    }
    return { shows: 0 }
}

function write(memory: HintMemory): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(memory))
    } catch {
        // Without storage the nudge just behaves as if for a new visitor.
    }
}

export function shouldShowSwipeHint(repeatDays: number): boolean {
    const m = read()
    if (m.hasSwiped) return false
    if (m.shows === 0) return true
    if (m.shows >= MAX_SHOWS) return false
    return Date.now() - (m.lastShownAt ?? 0) > repeatDays * DAY_MS
}

export function recordSwipeHintShown(): void {
    const m = read()
    write({ ...m, shows: m.shows + 1, lastShownAt: Date.now() })
}

export function recordSwiped(): void {
    const m = read()
    if (!m.hasSwiped) write({ ...m, hasSwiped: true })
}

export function resetSwipeHintMemory(): void {
    try {
        localStorage.removeItem(KEY)
    } catch {
        // Nothing to reset.
    }
}
