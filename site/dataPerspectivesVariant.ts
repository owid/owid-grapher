/**
 * Variant parsing for the data-perspectives prototype.
 *
 * Kept out of the component file so the component module only exports a
 * component (oxlint's react/only-export-components rule, which keeps React
 * fast-refresh working).
 */

export type DataPerspectivesPosition =
    | "left"
    | "right"
    | "above"
    | "below"
    | "off"
export type DataPerspectivesLayout =
    | "rail"
    | "strip"
    | "grid"
    | "swipe"
    | "pageswipe"
    | "accordion"
    | "explorer"
export type DataPerspectivesDensity = "thumb" | "title" | "full" | "detail"
/** Whether thumbnails carry the full chart chrome or a bare plot. */
export type DataPerspectivesChrome = "bare" | "full"
/**
 * Which content each swipe axis moves through, in the full-screen explorer.
 *   articles: horizontal = perspectives, vertical = related articles
 *   pages:    horizontal = related data pages, vertical = perspectives
 */
export type DataPerspectivesAxes = "articles" | "pages"
/**
 * How strongly the perspective and the chart read as one unit (pageswipe):
 *   panel     — (default) the perspective and chart share one white panel on
 *               a light-grey page; no box behind the perspective, no border
 *               around the chart
 *   card      — the perspective in its own box above a normal, bordered chart
 *   seamless  — no box, no chart border: one continuous block
 *   narrative — seamless, and the perspective's title *becomes* the chart's
 *               title; the indicator's own title moves, in bold, to the front
 *               of its (unchanged) subtitle
 */
export type DataPerspectivesStyle = "panel" | "card" | "seamless" | "narrative"
/**
 * What happens to a narrative title once the reader changes the view (adds a
 * country, moves the timeline, switches tab) and it no longer describes it:
 *   hide    — the narrative title becomes blank space (its room is kept)
 *   disable — the narrative title stays, struck through and greyed
 * Either way there's a control to jump back to the perspective.
 */
export type DataPerspectivesNarrativeStale = "hide" | "disable"
/** A bottom drawer: the perspectives, related content, or the metadata. */
export type DataPerspectivesDrawer =
    | "off"
    | "perspectives"
    | "related"
    | "metadata"
export type DataPerspectivesDrawerLayout = "vertical" | "horizontal"

export interface DataPerspectivesVariant {
    position: DataPerspectivesPosition
    layout: DataPerspectivesLayout
    density: DataPerspectivesDensity
    chrome: DataPerspectivesChrome
    axes: DataPerspectivesAxes
    style: DataPerspectivesStyle
    narrativeStale: DataPerspectivesNarrativeStale
    drawer: DataPerspectivesDrawer
    drawerLayout: DataPerspectivesDrawerLayout
    /** How long the swipe nudge waits before appearing, in ms. */
    hintDelayMs: number
    /** Days before the nudge may show again to someone who's never swiped. */
    hintRepeatDays: number
    /** Forget whether this browser has seen the nudge (for testing). */
    hintReset: boolean
    count?: number
    /** `dp…` params that were present but couldn't be used (typos etc). */
    ignored: string[]
}

const POSITIONS = ["left", "right", "above", "below", "off"]
const LAYOUTS = [
    "rail",
    "strip",
    "grid",
    "swipe",
    "pageswipe",
    "accordion",
    "explorer",
]
const DENSITIES = ["thumb", "title", "full", "detail"]
const CHROMES = ["bare", "full"]
const AXES = ["articles", "pages"]
const STYLES = ["panel", "card", "seamless", "narrative"]
const NARRATIVE_STALE = ["hide", "disable"]
const DRAWERS = ["off", "perspectives", "related", "metadata"]
const DRAWER_LAYOUTS = ["vertical", "horizontal"]

const KNOWN_KEYS = [
    "dp",
    "dpLayout",
    "dpDensity",
    "dpChrome",
    "dpAxes",
    "dpStyle",
    "dpNarrativeStale",
    "dpDrawer",
    "dpDrawerLayout",
    "dpHintDelay",
    "dpHintRepeatDays",
    "dpHintReset",
    "dpN",
]

interface LenientParams {
    get: (key: string) => string | null
    has: (key: string) => boolean
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
        has: (key) => byLower.has(key.toLowerCase()),
        ignored,
    }
}

/**
 * One of `allowed`, matched case-insensitively and accepting singular/plural
 * (so `perspective` works as well as `perspectives`); otherwise the fallback,
 * with the value noted as ignored.
 */
const pick = <T extends string>(
    key: string,
    allowed: string[],
    fallback: T,
    params: LenientParams
): T => {
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

/** A number ≥ `min`, or the fallback — noting it as ignored if it was garbage. */
const pickNumber = (
    key: string,
    min: number,
    fallback: number,
    params: LenientParams
): number => {
    if (!params.has(key)) return fallback
    const n = Number(params.get(key))
    if (Number.isFinite(n) && n >= min) return n
    params.ignored.push(`${key}=${params.get(key)}`)
    return fallback
}

export function parseDataPerspectivesVariant(
    search: string | undefined
): DataPerspectivesVariant {
    const params = lenientParams(search)
    const position = pick<DataPerspectivesPosition>(
        "dp",
        POSITIONS,
        "left",
        params
    )
    // Sensible pairing unless the layout is set explicitly: a side column wants
    // a vertical rail, above/below wants a horizontal strip.
    const defaultLayout: DataPerspectivesLayout =
        position === "left" || position === "right" ? "rail" : "strip"
    const layout = pick<DataPerspectivesLayout>(
        "dpLayout",
        LAYOUTS,
        defaultLayout,
        params
    )
    const density = pick<DataPerspectivesDensity>(
        "dpDensity",
        DENSITIES,
        "title",
        params
    )
    // Full chart chrome (title, subtitle, source line, logo) is illegible at
    // rail size, so thumbnails default to a bare plot.
    const chrome = pick<DataPerspectivesChrome>(
        "dpChrome",
        CHROMES,
        "bare",
        params
    )

    const axes = pick<DataPerspectivesAxes>("dpAxes", AXES, "articles", params)

    const style = pick<DataPerspectivesStyle>(
        "dpStyle",
        STYLES,
        "panel",
        params
    )

    const narrativeStale = pick<DataPerspectivesNarrativeStale>(
        "dpNarrativeStale",
        NARRATIVE_STALE,
        "hide",
        params
    )
    const drawer = pick<DataPerspectivesDrawer>(
        "dpDrawer",
        DRAWERS,
        "off",
        params
    )
    const drawerLayout = pick<DataPerspectivesDrawerLayout>(
        "dpDrawerLayout",
        DRAWER_LAYOUTS,
        "vertical",
        params
    )

    // Seconds, so it's easy to tune by hand in the URL. 0 shows it at once.
    // Pageswipe waits longer: its nudge is aimed at readers who have taken in
    // the first view and are deciding whether to move on.
    const hintDelayMs =
        pickNumber("dpHintDelay", 0, layout === "pageswipe" ? 5 : 3, params) *
        1000
    const hintRepeatDays = pickNumber("dpHintRepeatDays", 0, 7, params)
    const hintReset = params.get("dpHintReset") === "1"
    const rawCount = pickNumber("dpN", 1, 0, params)
    const count = rawCount > 0 ? rawCount : undefined

    return {
        position,
        layout,
        density,
        chrome,
        axes,
        style,
        narrativeStale,
        // A perspectives drawer *is* the perspectives UI, so no inline array
        // alongside it; a related-content drawer sits alongside any layout.
        drawer,
        drawerLayout,
        hintDelayMs,
        hintRepeatDays,
        hintReset,
        count,
        ignored: params.ignored,
    }
}

/**
 * A thumbnail is a small chart, so by default we ask the image service for its
 * purpose-built thumbnail render: `imType=thumbnail` lays the chart out at
 * 300x160 using GrapherVariant.Thumbnail (rather than shrinking the full
 * chart), and `imMinimal=0` keeps the labelling rather than thinning it.
 * `?dpChrome=full` falls back to the standard full-chrome render.
 */
export function thumbQueryString(
    queryParams: string,
    chrome: DataPerspectivesVariant["chrome"]
): string {
    if (chrome === "full") return `?${queryParams}`
    return `?${queryParams}&imType=thumbnail&imMinimal=0`
}

const VARIANT_STORAGE_KEY = "owid-data-perspectives-variant"

/**
 * The query string to read the variant from.
 *
 * Grapher writes its own state to the URL by replacing the whole query string,
 * which drops our `dp*` params — so after one click, a reload would silently
 * fall back to the default variant. Whenever the URL does carry `dp*` params
 * we remember them for the session; when it doesn't, we fall back to those.
 */
export function resolveVariantSearch(): string {
    const params = new URLSearchParams(window.location.search)
    const ours = new URLSearchParams()
    for (const [key, value] of params) {
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
