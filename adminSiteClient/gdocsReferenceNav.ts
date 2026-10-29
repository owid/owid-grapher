import {
    GUIDE_CATEGORIES,
    GuideReference,
    OwidGdocType,
    TemplateReference,
} from "@ourworldindata/types"

/**
 * Templates are ranked by how widely they're published — the ones editors
 * touch most often lead the list — falling back to alphabetical order when
 * usage totals aren't available yet (or a template has none recorded).
 */
export function sortTemplatesByUsage(
    templates: TemplateReference[],
    totals: Partial<Record<OwidGdocType, number>> | undefined
): TemplateReference[] {
    return [...templates].sort(
        (a, b) =>
            (totals?.[b.id as OwidGdocType] ?? 0) -
                (totals?.[a.id as OwidGdocType] ?? 0) ||
            a.title.localeCompare(b.title)
    )
}

/**
 * Moves the sidebar search's highlighted-row index by one step, wrapping
 * around both ends. `undefined` (nothing highlighted yet) steps to the first
 * row on ArrowDown and the last row on ArrowUp; an empty result list has
 * nothing to highlight, so it always yields `undefined`.
 */
export function stepHighlight(
    current: number | undefined,
    delta: 1 | -1,
    length: number
): number | undefined {
    if (length === 0) return undefined
    if (current === undefined) return delta === 1 ? 0 : length - 1
    return (current + delta + length) % length
}

/**
 * Guides are not usage-ranked: they list by category in presentation order,
 * then by title.
 */
export function sortGuides(guides: GuideReference[]): GuideReference[] {
    const rank = new Map<string, number>(
        GUIDE_CATEGORIES.map((category, index) => [category, index])
    )
    return [...guides].sort(
        (a, b) =>
            (rank.get(a.category) ?? 0) - (rank.get(b.category) ?? 0) ||
            a.title.localeCompare(b.title)
    )
}

/** The reference page's route params: `/gdocs-reference/:kind?/:id?/:bundle?` */
export type ReferenceRouteParams = {
    kind?: string
    id?: string
    bundle?: string
}

export const BESPOKE_COMPONENT_ID = "bespoke-component"

/** The page a reference URL points at */
export interface Selection {
    kind: "components" | "templates" | "guides"
    id: string
    /** A bundle of the bespoke component; unset on every other page */
    bundle?: string
}

/** Route params → the page to show; undefined for the landing page. */
export function selectionFromParams(
    params: ReferenceRouteParams
): Selection | undefined {
    const { kind, id, bundle } = params
    if (!id) return undefined
    // Only the bespoke component has sub-pages (one per bundle); a third
    // segment anywhere else is ignored.
    if (kind === "components" && id === BESPOKE_COMPONENT_ID && bundle)
        return { kind, id, bundle }
    if (kind === "components" || kind === "templates" || kind === "guides")
        return { kind, id }
    return undefined
}
