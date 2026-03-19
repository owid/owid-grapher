export function makeAxisLabel({
    label,
    displayUnit,
}: {
    label: string
    displayUnit?: string
}): {
    mainLabel: string // shown in bold
    unit?: string // shown in normal weight, usually in parens
} {
    // No unit to display
    if (!displayUnit) return { mainLabel: label }

    // Extract text in parens at the end of the label,
    // e.g. "Population (millions)" is split into "Population " and "(millions)"
    const [
        _fullMatch,
        untrimmedMainLabelText = undefined,
        labelTextInParens = undefined,
    ] = label.trim().match(/^(.*?)(\([^()]*\))?$/s) ?? []
    const mainLabelText = untrimmedMainLabelText?.trim() ?? ""

    // Don't show unit twice if it's contained in the label
    const displayLabel =
        labelTextInParens === `(${displayUnit})` ? mainLabelText : label

    return { mainLabel: displayLabel, unit: displayUnit }
}
