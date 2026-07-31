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

const GRAPHER_PART_ATTRIBUTE = "data-grapher-part"

/** Generic text-bearing tags; metadata ends up in these whoever renders them */
const CANDIDATE_SELECTOR =
    "h1,h2,h3,h4,h5,h6,p,li,dd,dt,td,th,figcaption,blockquote,span"

/** Our own UI must never be mistaken for page content */
const EXCLUDED_SELECTOR =
    ".comments-overlay__panel,.comments-overlay__toggle,.comments-anchor-badge"

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
    if (field.grapherPart) {
        return document.querySelector<HTMLElement>(
            `[${GRAPHER_PART_ATTRIBUTE}="${field.grapherPart}"]`
        )
    }
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
        // Long values get truncated or split across elements by the renderer,
        // so accept an element that starts the value as well as an exact match
        const matches =
            text === wanted ||
            (wanted.length > 40 && text.startsWith(wanted.slice(0, 40)))
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

/** The field whose element contains this click, if any */
export function fieldForClick(
    clicked: Element,
    fields: CommentField[]
): CommentField | undefined {
    if (clicked.closest(EXCLUDED_SELECTOR)) return undefined
    for (const field of fields) {
        const element = findFieldElement(field)
        if (element && (element === clicked || element.contains(clicked)))
            return field
    }
    return undefined
}
