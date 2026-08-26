/**
 * Whether two SVGs paint the same pixels.
 *
 * The pipeline compares markup, which is the right call for a pass/fail gate but
 * flags charts that paint identically all the same — reordered attributes,
 * generated ids, an empty group. This is what tells those apart, so the report
 * can set them aside.
 *
 * Answers belong to a run rather than to whichever tab did the work, so the
 * bottom half of this file keeps them against the run's identity — a reopened
 * report then doesn't rasterize everything again.
 */

/**
 * How many pairs to work on at once. Each holds two pixel buffers of a couple of
 * megabytes, so this is a memory bound; it is also a throughput one, since each
 * pair spends most of its life waiting to be handed control back.
 */
export const VISUAL_DIFF_CONCURRENCY = 8

/**
 * When to give up on a single pair. A decode that never settles would otherwise
 * hold its place forever and stall everything behind it.
 */
const COMPARISON_TIMEOUT_MS = 20_000

/**
 * How long a yield may wait for an idle moment before going ahead anyway. An
 * idle callback has no deadline of its own, so on a page that stays busy it can
 * sit indefinitely, and a pair needs several yields to get through.
 */
const IDLE_DEADLINE_MS = 100

/** An SVG's pixels, ready to compare */
export interface RasterizedSvg {
    width: number
    height: number
    data: Uint8ClampedArray
}

export type LoadPixels = (
    url: string,
    abandoned?: AbortSignal
) => Promise<RasterizedSvg | undefined>

/**
 * What a comparison came to. Not a boolean plus undefined: `!identical` would
 * read a pair nothing is known about as one that changed.
 *
 * "unknown" is a real outcome, not just a hiccup: an SVG containing a
 * `<foreignObject>` taints the canvas, since it could embed arbitrary HTML, so
 * its pixels can never be read back.
 */
export type VisualVerdict = "identical" | "changed" | "unknown"

/**
 * The differences split by what the pixel check came to, each bucket keeping the
 * order the report lists them in. The buckets are declared review-first, which
 * is the order the report walks them in.
 */
export function groupByVisualVerdict<T extends { svgFilename: string }>(
    entries: T[],
    verdicts: Record<string, VisualVerdict>
): Record<VisualVerdict, T[]> {
    const grouped: Record<VisualVerdict, T[]> = {
        changed: [],
        unknown: [],
        identical: [],
    }
    for (const entry of entries)
        grouped[verdicts[entry.svgFilename] ?? "changed"].push(entry)
    return grouped
}

export function createVisualDiffChecker(loadPixels: LoadPixels): {
    /**
     * What the two SVGs' pixels came to. Never rejects, and never hangs, and
     * does the work every time it is asked — nothing here remembers an answer,
     * least of all one that never arrived.
     */
    compare: (beforeUrl: string, afterUrl: string) => Promise<VisualVerdict>
} {
    async function compareNow(
        beforeUrl: string,
        afterUrl: string,
        abandoned: AbortSignal
    ): Promise<VisualVerdict> {
        const [before, after] = await Promise.all([
            loadPixels(beforeUrl, abandoned),
            loadPixels(afterUrl, abandoned),
        ])
        if (!before || !after) return "unknown"
        // A chart that changed size has visibly changed
        if (before.width !== after.width || before.height !== after.height)
            return "changed"
        // Comparing a few million bytes is the one long stretch left, so let
        // anything the user is doing go first
        await yieldToPage()
        if (abandoned.aborted) return "unknown"
        return pixelsEqual(before.data, after.data) ? "identical" : "changed"
    }

    function compare(
        beforeUrl: string,
        afterUrl: string
    ): Promise<VisualVerdict> {
        // Giving up on a pair stops the work behind it too, so a decode that
        // stalled doesn't carry on rasterizing once its slot has moved on
        const giveUp = new AbortController()
        return withTimeout(compareNow(beforeUrl, afterUrl, giveUp.signal), () =>
            giveUp.abort()
        )
    }

    return { compare }
}

function pixelsEqual(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false
    }
    return true
}

/** Reports a comparison that never came back, rather than never resolving */
function withTimeout(
    comparison: Promise<VisualVerdict>,
    onTimeout: () => void
): Promise<VisualVerdict> {
    return new Promise<VisualVerdict>((resolve) => {
        const timer = setTimeout(() => {
            onTimeout()
            resolve("unknown")
        }, COMPARISON_TIMEOUT_MS)
        void comparison.then(
            (verdict) => {
                clearTimeout(timer)
                resolve(verdict)
            },
            () => {
                clearTimeout(timer)
                resolve("unknown")
            }
        )
    })
}

/**
 * Hands control back between pieces of work.
 *
 * With the tab in front that means waiting for an idle moment, so checking a big
 * suite doesn't make the report sluggish. With it behind, idle callbacks stop
 * firing altogether and timers are throttled to about once a minute, which would
 * stall the check — so it hands back through a message channel instead, which is
 * not throttled. There is nobody interacting to yield to in that case anyway.
 */
function yieldToPage(): Promise<void> {
    if (typeof document !== "undefined" && document.hidden)
        return nextMacrotask()
    return new Promise((resolve) => {
        if (typeof requestIdleCallback === "function")
            requestIdleCallback(() => resolve(), { timeout: IDLE_DEADLINE_MS })
        else setTimeout(resolve, 0)
    })
}

let channel: MessageChannel | undefined
const macrotaskWaiting: (() => void)[] = []

/** One shared channel: a fresh one per yield would be tens of thousands of them */
function nextMacrotask(): Promise<void> {
    if (typeof MessageChannel === "undefined")
        return new Promise((resolve) => setTimeout(resolve, 0))
    return new Promise((resolve) => {
        if (!channel) {
            channel = new MessageChannel()
            channel.port1.onmessage = () => macrotaskWaiting.shift()?.()
        }
        macrotaskWaiting.push(resolve)
        channel.port2.postMessage(undefined)
    })
}

/** Draws an SVG to a canvas and reads its pixels back */
async function loadPixelsFromDom(
    url: string,
    abandoned?: AbortSignal
): Promise<RasterizedSvg | undefined> {
    try {
        const image = new Image()
        image.src = url
        // Yields on its own, and doesn't block while it decodes
        await image.decode()
        if (abandoned?.aborted) return undefined

        const { naturalWidth: width, naturalHeight: height } = image
        if (!width || !height) return undefined

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) return undefined

        // Drawing is where the SVG actually gets rasterized, so yield first —
        // and check afterwards, since this is the expensive part to skip
        await yieldToPage()
        if (abandoned?.aborted) return undefined
        ctx.drawImage(image, 0, 0)
        return {
            width,
            height,
            data: ctx.getImageData(0, 0, width, height).data,
        }
    } catch (error) {
        // Logged rather than swallowed, so a check that is failing can't pass
        // for one that found nothing. A SecurityError here is the canvas
        // refusing to be read: see VisualVerdict.
        console.warn("[svg visual diff] could not rasterize", url, error)
        return undefined
    }
}

/** Whether the two SVGs paint the same pixels */
export const { compare: compareSvgsVisually } =
    createVisualDiffChecker(loadPixelsFromDom)

// ————— Remembering what a run came to —————
//
// Checking a suite means rasterizing both SVGs of every difference — thousands
// of pairs, minutes of work — so the answers are written down as they arrive.

/** Bump when the stored shape changes: older entries are then never read */
const STORAGE_KEY_PREFIX = "svgtester-visual-diff:v2:"

/**
 * One run's answers, as the exceptions rather than the map: within the stretch
 * that has been checked, anything neither list names came out identical.
 *
 * How far the check got is a single index rather than a list of what's done,
 * which is what keeps this to a few hundred bytes however far along it is —
 * small enough to keep writing as the answers arrive, so switching away
 * mid-check doesn't cost the work.
 */
export interface StoredVerdicts {
    /** The run these answers are about, and the only thing matched on */
    runKey: string
    /** How many differences the run reported, as a guard against a stale list */
    total: number
    /** Everything before this, in the run's own order, has been answered */
    checkedPrefix: number
    changed: string[]
    unknown: string[]
    /** Recorded to make a puzzling report diagnosable, never matched on */
    grapherCommit: string | null
    svgsCommit: string | null
}

export function encodeVerdicts({
    runKey,
    svgFilenames,
    verdicts,
    grapherCommit,
    svgsCommit,
}: {
    runKey: string
    /** In the order the run reported them, which is what the prefix indexes */
    svgFilenames: string[]
    verdicts: Record<string, VisualVerdict>
    grapherCommit: string | null
    svgsCommit: string | null
}): StoredVerdicts {
    // Answers past the first unanswered chart are dropped rather than tracked
    // one by one. Only a handful are ever lost: the check runs a few pairs at a
    // time, so it can only be that far out of order.
    let checkedPrefix = 0
    while (
        checkedPrefix < svgFilenames.length &&
        verdicts[svgFilenames[checkedPrefix]]
    )
        checkedPrefix++

    const checked = svgFilenames.slice(0, checkedPrefix)
    const named = (wanted: VisualVerdict): string[] =>
        checked.filter((name) => verdicts[name] === wanted)

    return {
        runKey,
        total: svgFilenames.length,
        checkedPrefix,
        changed: named("changed"),
        unknown: named("unknown"),
        grapherCommit,
        svgsCommit,
    }
}

/**
 * The answers for these filenames, or undefined for answers that aren't about
 * the run in front of us. Unknowns come back as unknowns rather than being
 * dropped: the report should say a chart couldn't be checked, and the caller can
 * decide to ask again.
 */
export function decodeVerdicts(
    stored: StoredVerdicts | undefined,
    runKey: string,
    svgFilenames: string[]
): Record<string, VisualVerdict> | undefined {
    if (!stored || stored.runKey !== runKey) return undefined
    // A run's difference list can't change under it, so this only fires if
    // something has gone wrong enough that the answers can't be trusted
    if (stored.total !== svgFilenames.length) return undefined
    if (!Array.isArray(stored.changed) || !Array.isArray(stored.unknown))
        return undefined
    if (typeof stored.checkedPrefix !== "number") return undefined

    const changed = new Set(stored.changed)
    const unknown = new Set(stored.unknown)

    // Past the prefix nothing is claimed, so the caller checks those itself
    return Object.fromEntries(
        svgFilenames
            .slice(0, stored.checkedPrefix)
            .map((name) => [
                name,
                changed.has(name)
                    ? "changed"
                    : unknown.has(name)
                      ? "unknown"
                      : "identical",
            ])
    )
}

/**
 * Where a suite's answers are kept, or nowhere at all.
 *
 * Reaching for storage is itself allowed to fail: an origin that can't have any
 * — sandboxed, or a browser told to block it — throws on the getter rather than
 * leaving it undefined, so even asking whether it exists has to be guarded.
 */
function storage(): Storage | undefined {
    try {
        return typeof localStorage === "undefined" ? undefined : localStorage
    } catch {
        return undefined
    }
}

/** Whatever is on record for a suite, in whatever shape it turns out to be */
function readStored(store: Storage, suite: string): StoredVerdicts | undefined {
    try {
        const raw = store.getItem(STORAGE_KEY_PREFIX + suite)
        return raw ? JSON.parse(raw) : undefined
    } catch {
        return undefined
    }
}

/**
 * One entry per suite, holding whichever run it was last checked for. A new run
 * overwrites it, which is all the pruning this needs: an earlier run's answers
 * are worthless once it has been superseded.
 *
 * Nothing here is allowed to break the report, so a store that can't be read or
 * written just means doing the work again. Writing throws once the origin's
 * quota is used up — shared with everything else the admin keeps there — and
 * historically throws outright in Safari's private browsing.
 */
export function readVerdicts(
    suite: string,
    runKey: string,
    svgFilenames: string[]
): Record<string, VisualVerdict> | undefined {
    const store = storage()
    if (!store) return undefined
    return decodeVerdicts(readStored(store, suite), runKey, svgFilenames)
}

export function writeVerdicts(suite: string, stored: StoredVerdicts): void {
    const store = storage()
    if (!store) return

    // Two tabs can be checking the same run, and the entry is shared: a save
    // from the one that is behind — its parting save on the way out, most
    // likely — must not undo the progress the other has made. A save for a
    // different run always wins, since that one supersedes it.
    const onRecord = readStored(store, suite)
    if (
        onRecord?.runKey === stored.runKey &&
        onRecord.checkedPrefix > stored.checkedPrefix
    )
        return

    const key = STORAGE_KEY_PREFIX + suite
    try {
        store.setItem(key, JSON.stringify(stored))
    } catch {
        // Half-written is worse than absent: an entry that failed to save could
        // be an older run's, which would then be read as this one's
        try {
            store.removeItem(key)
        } catch {
            // Nothing left to try, and nothing that depends on it
        }
    }
}
