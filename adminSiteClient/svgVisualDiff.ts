/**
 * Whether two SVGs paint the same pixels.
 *
 * The pipeline compares markup, which is the right call for a pass/fail gate but
 * flags charts that paint identically all the same — reordered attributes,
 * generated ids, an empty group. This is what tells those apart, so the report
 * can set them aside.
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

/**
 * How many runs' worth of answers to keep. Revisiting the suite you just left is
 * then free, without holding every answer for every run the tab has ever shown.
 */
const MAX_CACHED_RUNS = 4

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

export function createVisualDiffChecker(loadPixels: LoadPixels): {
    /**
     * What the two SVGs' pixels came to. Never rejects, and never hangs.
     * `runKey` scopes the cache, since the next run serves different files from
     * the same URLs. A pair that couldn't be checked isn't remembered, so asking
     * again does the work again.
     */
    compare: (
        beforeUrl: string,
        afterUrl: string,
        runKey: string
    ) => Promise<VisualVerdict>
} {
    const cachesByRun = new Map<string, Map<string, Promise<VisualVerdict>>>()

    function cacheFor(runKey: string): Map<string, Promise<VisualVerdict>> {
        const existing = cachesByRun.get(runKey)
        if (existing) return existing

        const cache = new Map<string, Promise<VisualVerdict>>()
        cachesByRun.set(runKey, cache)
        // Insertion-ordered, so this drops the runs left longest ago
        for (const stale of [...cachesByRun.keys()].slice(0, -MAX_CACHED_RUNS))
            cachesByRun.delete(stale)
        return cache
    }

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
        afterUrl: string,
        runKey: string
    ): Promise<VisualVerdict> {
        const cache = cacheFor(runKey)
        const key = `${beforeUrl}\n${afterUrl}`

        const cached = cache.get(key)
        // Caching the promise rather than the answer also collapses duplicate
        // requests for a pair that is still being compared
        if (cached) return cached

        // Giving up on a pair stops the work behind it too, so a decode that
        // stalled doesn't carry on rasterizing once its slot has moved on
        const giveUp = new AbortController()
        const result = withTimeout(
            compareNow(beforeUrl, afterUrl, giveUp.signal),
            () => giveUp.abort()
        ).then((verdict) => {
            // Forgotten rather than remembered: never hold a pair to an answer
            // that never arrived
            if (verdict === "unknown") cache.delete(key)
            return verdict
        })
        cache.set(key, result)
        return result
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
