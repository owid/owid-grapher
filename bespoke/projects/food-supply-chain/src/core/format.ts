import { formatValue } from "@ourworldindata/utils"

/** A value as the chart writes it; one that would round to zero reads "<0.1 g" */
export function formatMeasureValue(
    value: number,
    {
        numDecimalPlaces,
        unit,
        showPlus,
    }: { numDecimalPlaces: number; unit?: string; showPlus?: boolean }
): string {
    const smallestShownValue = 10 ** -numDecimalPlaces
    if (value !== 0 && Math.abs(value) < smallestShownValue / 2) {
        const sign = value < 0 ? "-" : showPlus ? "+" : ""
        const bound = formatValue(smallestShownValue, {
            numDecimalPlaces,
            unit,
        })
        return `${sign}<${bound}`
    }

    return formatValue(value, { numDecimalPlaces, unit, showPlus })
}
