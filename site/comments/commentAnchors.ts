import { CommentField } from "./commentFields.js"

/**
 * Finding where a metadata field is shown on the page, so a pin can be put next
 * to it. Purely presentational: a comment is identified by its field key, so a
 * field we fail to locate still shows in the panel and can still be commented
 * on - it just doesn't get a pin.
 *
 * Nothing here knows how a data page is laid out. Chart-level fields are found
 * through grapher's own data-grapher-part hooks; indicator metadata is found by
 * matching the field's current value against what's on screen.
 */

/** Set by whichever component renders a metadata field */
export const FIELD_ATTRIBUTE = "data-comment-field"

const GRAPHER_PART_ATTRIBUTE = "data-grapher-part"

/**
 * Generic text-bearing tags; metadata ends up in these whoever renders them.
 * div and the list tags matter as much as the semantic ones - data pages render
 * most metadata values into plain divs, and a markdown field becomes a ul - so
 * leaving them out silently made most fields unlocatable.
 */
const CANDIDATE_SELECTOR =
    "h1,h2,h3,h4,h5,h6,p,li,dd,dt,td,th,figcaption,blockquote,span,div,ul,ol"

/** Our own UI must never be mistaken for page content */
const EXCLUDED_SELECTOR =
    ".comments-bubbles,.comments-overlay__toggle,.comments-popover,.comments-other-views"

export function normalizeText(text: string): string {
    return text.replace(/\s+/g, " ").trim()
}

/**
 * Markdown values reach the DOM rendered: links lose their targets and emphasis
 * loses its markers. Strip the common markers so a value still matches the text
 * it produced.
 */
function forMatching(text: string): string {
    return normalizeText(
        text
            .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [label](url) -> label
            .replace(/[*_`#>]/g, "")
    ).toLowerCase()
}

export function findFieldElement(field: CommentField): HTMLElement | null {
    // Whichever component renders a field says so with data-comment-field. It
    // is one attribute, it moves with the field if the page is rearranged, and
    // it is the only reliable option: values are formatted before they are
    // rendered - a date becomes "October 22, 2025", markdown becomes a list -
    // so matching the raw value against the DOM misses most fields.
    const declared = document.querySelector<HTMLElement>(
        `[${FIELD_ATTRIBUTE}="${field.key}"]`
    )
    if (declared) return declared

    if (field.grapherPart) {
        return document.querySelector<HTMLElement>(
            `[${GRAPHER_PART_ATTRIBUTE}="${field.grapherPart}"]`
        )
    }
    // Fallback for anything not marked up, so an unmarked field still gets a
    // bubble when its value happens to be on the page verbatim
    if (!field.value) return null
    const wanted = forMatching(field.value)
    if (wanted.length < 2) return null

    let best: HTMLElement | null = null
    let bestLength = Infinity
    for (const element of document.querySelectorAll<HTMLElement>(
        CANDIDATE_SELECTOR
    )) {
        if (element.closest(EXCLUDED_SELECTOR)) continue
        const text = forMatching(element.textContent ?? "")
        if (!text) continue
        // A long value gets split across elements by the renderer - markdown
        // becomes a list, prose gets wrapped - so also accept the element that
        // starts it. The length bound keeps that from matching a whole section
        // that merely happens to begin with the field.
        const matches =
            text === wanted ||
            (wanted.length > 40 &&
                text.startsWith(wanted.slice(0, 40)) &&
                text.length <= wanted.length * 1.5 + 40)
        if (!matches) continue
        // Deepest match wins: the field itself, not a container holding it
        const length = (element.textContent ?? "").length
        if (length < bestLength) {
            best = element
            bestLength = length
        }
    }
    return best
}
