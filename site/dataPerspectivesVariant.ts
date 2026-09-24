/**
 * URL params for the data-perspectives prototype.
 *
 *   ?dpLayout=pageswipe|accordion
 *       pageswipe — swipe anywhere on the page to step through perspectives;
 *                   each one is applied to the page's live chart
 *       accordion — no chart at the top: the page is a list of perspectives,
 *                   each expanding into its own chart
 *       Without dpLayout the data page is unchanged.
 *
 *   ?dpStyle=panel|card|seamless|narrative   (pageswipe only)
 *       How strongly the perspective and the chart read as one unit.
 *
 *   ?dpNarrativeStale=hide|disable|revert   (dpStyle=narrative only)
 *       What happens to the narrative title once the reader changes the view.
 *
 *   ?dpUpNext=1
 *       An "Up next" article carousel in place of Research & writing.
 *
 *   ?dpHintReset=1
 *       Testing aid: forget whether this browser has seen the swipe nudge.
 */

export type DataPerspectivesLayout = "off" | "pageswipe" | "accordion"

/**
 * How strongly the perspective and the chart read as one unit (pageswipe):
 *   panel     — (default) the perspective and chart share one white panel on
 *               a light-grey page; no box behind the perspective, no border
 *               around the chart
 *   card      — the perspective in its own box above a normal, bordered chart
 *   seamless  — no box and no chart border, on the normal white page
 *   narrative — like panel, but the perspective's title *becomes* the chart's
 *               title; the chart's own title moves, in bold, to the front of
 *               its subtitle
 */
export type DataPerspectivesStyle = "panel" | "card" | "seamless" | "narrative"

/**
 * What happens to a narrative title once the reader changes the view (adds a
 * country, moves the timeline, switches tab) and it no longer describes it:
 *   hide    — (default) the title becomes blank space; its room is kept
 *   disable — the title stays, greyed and struck through
 *   revert  — the chart's original title and subtitle come back
 * hide and disable offer a control to jump back to the perspective; revert
 * doesn't, since the chart is simply back to its own title.
 */
export type DataPerspectivesNarrativeStale = "hide" | "disable" | "revert"

export interface DataPerspectivesVariant {
    layout: DataPerspectivesLayout
    style: DataPerspectivesStyle
    narrativeStale: DataPerspectivesNarrativeStale
    /** The "Up next" article carousel, in place of Research & writing. */
    upNext: boolean
    /** Forget whether this browser has seen the swipe nudge (for testing). */
    hintReset: boolean
    /** `dp…` params that were present but couldn't be used (typos etc). */
    ignored: string[]
}

const LAYOUTS = ["off", "pageswipe", "accordion"]
const STYLES = ["panel", "card", "seamless", "narrative"]
const NARRATIVE_STALE = ["hide", "disable", "revert"]
const KNOWN_KEYS = [
    "dpLayout",
    "dpStyle",
    "dpNarrativeStale",
    "dpUpNext",
    "dpHintReset",
]

interface LenientParams {
    get: (key: string) => string | null
    /** `key=value` pairs that were present but couldn't be used. */
    ignored: string[]
}

/**
 * Query params read forgivingly: keys are case-insensitive, and anything that
 * can't be used — an unknown `dp…` key, or a value that isn't one of the
 * options — is recorded rather than silently dropped, so a typo shows up on
 * the page instead of quietly doing nothing.
 */
function lenientParams(search: string | undefined): LenientParams {
    const byLower = new Map<string, { key: string; value: string }>()
    for (const [key, value] of new URLSearchParams(search ?? "")) {
        byLower.set(key.toLowerCase(), { key, value })
    }
    const known = new Set(KNOWN_KEYS.map((k) => k.toLowerCase()))
    const ignored: string[] = []
    for (const [lower, { key, value }] of byLower) {
        if (lower.startsWith("dp") && !known.has(lower))
            ignored.push(`${key}=${value}`)
    }
    return {
        get: (key) => byLower.get(key.toLowerCase())?.value ?? null,
        ignored,
    }
}

/**
 * One of `allowed`, matched case-insensitively and accepting singular/plural;
 * otherwise the fallback, with the value noted as ignored.
 */
function pick<T extends string>(
    key: string,
    allowed: string[],
    fallback: T,
    params: LenientParams
): T {
    const raw = params.get(key)
    if (raw === null || raw === "") return fallback
    const v = raw.toLowerCase()
    const hit = allowed.find((option) => {
        const o = option.toLowerCase()
        return o === v || o === `${v}s` || `${o}s` === v
    })
    if (hit) return hit as T
    params.ignored.push(`${key}=${raw}`)
    return fallback
}

export function parseDataPerspectivesVariant(
    search: string | undefined
): DataPerspectivesVariant {
    const params = lenientParams(search)
    return {
        layout: pick<DataPerspectivesLayout>(
            "dpLayout",
            LAYOUTS,
            "off",
            params
        ),
        style: pick<DataPerspectivesStyle>("dpStyle", STYLES, "panel", params),
        narrativeStale: pick<DataPerspectivesNarrativeStale>(
            "dpNarrativeStale",
            NARRATIVE_STALE,
            "hide",
            params
        ),
        upNext: params.get("dpUpNext") === "1",
        hintReset: params.get("dpHintReset") === "1",
        ignored: params.ignored,
    }
}

const VARIANT_STORAGE_KEY = "owid-data-perspectives-variant"

/**
 * The query string to read the variant from.
 *
 * Grapher writes its own state to the URL by replacing the whole query string,
 * which drops our `dp…` params — so after one swipe, a reload would silently
 * fall back to no variant. Whenever the URL does carry `dp…` params we
 * remember them for the session; when it doesn't, we fall back to those.
 */
export function resolveVariantSearch(): string {
    const ours = new URLSearchParams()
    for (const [key, value] of new URLSearchParams(window.location.search)) {
        if (key.toLowerCase().startsWith("dp")) ours.set(key, value)
    }
    try {
        if ([...ours.keys()].length > 0) {
            sessionStorage.setItem(VARIANT_STORAGE_KEY, ours.toString())
            return `?${ours.toString()}`
        }
        const saved = sessionStorage.getItem(VARIANT_STORAGE_KEY)
        if (saved) return `?${saved}`
    } catch {
        // Storage can be unavailable (private mode, blocked site data).
    }
    return `?${ours.toString()}`
}

/**
 * The thumbnail for a perspective: grapher's purpose-built thumbnail render
 * (`imType=thumbnail` lays the chart out at thumbnail size rather than
 * shrinking the full chart) with its labelling kept (`imMinimal=0`).
 */
export function thumbQueryString(queryParams: string): string {
    return `?${queryParams}&imType=thumbnail&imMinimal=0`
}
