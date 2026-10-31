import { CommentField } from "./commentFields.js"

/**
 * Finding where a metadata field is shown on the page, so a bubble can be put
 * next to it. Purely presentational: a comment is identified by its field key,
 * so a field we fail to locate simply gets no bubble.
 *
 * Every field is located by an explicit marker and nothing else. Chart-level
 * fields come from grapher's own data-grapher-part hooks; everything else is
 * marked with data-comment-field by whichever component renders it.
 *
 * We deliberately do NOT search the page for a field's text. That was the
 * previous fallback and it was wrong in both directions: it silently attached
 * bubbles to whatever element happened to hold matching words - a data page
 * renders the short description as the chart's subtitle, so two fields landed
 * on the same place - and finding it meant reading textContent off every
 * heading, paragraph, span and div on the page, allocating a copy of the page's
 * text on every pass. A field nobody has marked gets no bubble, which is
 * visible and fixable; a field anchored to the wrong element is neither.
 */

/** Set by whichever component renders a metadata field */
export const FIELD_ATTRIBUTE = "data-comment-field"

const GRAPHER_PART_ATTRIBUTE = "data-grapher-part"

export function findFieldElement(field: CommentField): HTMLElement | null {
    // Chart title, subtitle and note are drawn by grapher, which marks them for
    // its own reasons; on a multi-dim they change per view, so there is no
    // server-side value that could identify them anyway.
    if (field.grapherPart) {
        return document.querySelector<HTMLElement>(
            `[${GRAPHER_PART_ATTRIBUTE}="${field.grapherPart}"]`
        )
    }
    return document.querySelector<HTMLElement>(
        `[${FIELD_ATTRIBUTE}="${field.key}"]`
    )
}
