import { DualAxis } from "../axis/Axis"
import {
    MarimekkoSeries,
    PlacedMarimekkoSeries,
} from "./MarimekkoChartConstants"

export function toPlacedMarimekkoSeries(
    sortedSeries: readonly MarimekkoSeries[],
    { x0, dualAxis }: { x0: number; dualAxis: DualAxis }
): PlacedMarimekkoSeries[] {
    const placedSeries: PlacedMarimekkoSeries[] = []
    let currentX = 0
    for (const series of sortedSeries) {
        placedSeries.push({ ...series, xPosition: currentX })
        const xValue = series.xPoint?.value ?? 1 // one is the default here because if no x dim is given we make all bars the same width
        const preciseX =
            dualAxis.horizontalAxis.place(xValue) -
            dualAxis.horizontalAxis.place(x0)
        currentX += preciseX
    }
    return placedSeries
}
