import { OwidGdocType, TemplateReference } from "@ourworldindata/types"

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
