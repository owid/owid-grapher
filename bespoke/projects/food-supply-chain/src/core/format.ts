import { formatValue } from "@ourworldindata/utils"

/** Decimal places that keep a value readable at the scale of the given span */
export function decimalPlacesForSpan(span: number): number {
    const absSpan = Math.abs(span)
    if (absSpan >= 100) return 0
    if (absSpan >= 10) return 1
    return 2
}

/** A value as the chart writes it */
export function formatMeasureValue(
    value: number,
    {
        span,
        unit,
        showPlus,
    }: { span: number; unit?: string; showPlus?: boolean }
): string {
    return formatValue(value, {
        numDecimalPlaces: decimalPlacesForSpan(span),
        unit,
        showPlus,
    })
}
