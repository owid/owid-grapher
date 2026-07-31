/**
 * Comments are anchored to the text they were left on, not to a fixed list of
 * fields or to CSS selectors for particular components. Whatever is on screen
 * can be commented on, and because the anchor is the content rather than the
 * markup around it, a data page rearranging its layout doesn't invalidate
 * anything: the thread keeps its quote and simply stops being pinned if the
 * text is gone.
 */

/** comments.anchor is VARCHAR(255), so quotes are stored truncated */
export const MAX_ANCHOR_TEXT_LENGTH = 255

/**
 * Elements worth quoting. Deliberately generic - these are the tags metadata
 * and chart headers end up in, whichever component happens to render them.
 */
const CANDIDATE_SELECTOR =
    "h1,h2,h3,h4,h5,h6,p,li,dd,dt,td,th,figcaption,blockquote,a,span"

/** Ignore our own UI, and anything the site hides from view */
const EXCLUDED_SELECTOR =
    ".comments-overlay__panel,.comments-overlay__toggle,.comments-anchor-badge,script,style"

export function normalizeAnchorText(text: string): string {
    return text.replace(/\s+/g, " ").trim()
}

function anchorTextOf(element: Element): string {
    return normalizeAnchorText(element.textContent ?? "").slice(
        0,
        MAX_ANCHOR_TEXT_LENGTH
    )
}

/**
 * The quote for the element the user clicked. Walks up from the click target
 * to the nearest element that reads as a field or a piece of prose, so clicking
 * a link inside a subtitle still quotes something meaningful.
 */
export function anchorTextForClick(clicked: Element): string | null {
    if (clicked.closest(EXCLUDED_SELECTOR)) return null
    // Only text-bearing elements can be anchors. Without this, a click on
    // padding or a layout wrapper would climb to a container and quote most of
    // the page, so clicks on empty space are simply ignored - the composer is
    // still there for a comment about the page as a whole.
    const element = clicked.closest(CANDIDATE_SELECTOR)
    if (!element) return null
    return anchorTextOf(element) || null
}

/**
 * The smallest element currently displaying this quote, or null when the page
 * no longer shows it (layout changed, another multi-dim view, text edited).
 * Callers treat null as "thread is still valid, just not pinned".
 */
export function findAnchorElement(anchorText: string): HTMLElement | null {
    if (!anchorText) return null
    let best: HTMLElement | null = null
    let bestLength = Infinity
    for (const element of document.querySelectorAll<HTMLElement>(
        CANDIDATE_SELECTOR
    )) {
        if (element.closest(EXCLUDED_SELECTOR)) continue
        if (anchorTextOf(element) !== anchorText) continue
        // Prefer the deepest match: the shortest full text wins, which picks
        // the field itself rather than a container that happens to hold only it
        const length = (element.textContent ?? "").length
        if (length < bestLength) {
            best = element
            bestLength = length
        }
    }
    return best
}

/** Shortened quote for the panel, so a long paragraph stays one line */
export function anchorLabel(anchorText: string, maxLength = 60): string {
    const text = normalizeAnchorText(anchorText)
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`
}
