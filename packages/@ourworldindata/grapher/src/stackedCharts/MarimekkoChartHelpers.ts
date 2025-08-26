import { DualAxis } from "../axis/Axis"
import { PlacedItem } from "./MarimekkoChartConstants"
import { MarimekkoChartState } from "./MarimekkoChartState"

export function toPlacedMarimekkoItems(
    chartState: MarimekkoChartState,
    { dualAxis }: { dualAxis: DualAxis }
): PlacedItem[] {
    const { x0, sortedItems } = chartState
    const placedItems: PlacedItem[] = []
    let currentX = 0
    for (const item of sortedItems) {
        placedItems.push({ ...item, xPosition: currentX })
        const xValue = item.xPoint?.value ?? 1 // one is the default here because if no x dim is given we make all bars the same width
        const preciseX =
            dualAxis.horizontalAxis.place(xValue) -
            dualAxis.horizontalAxis.place(x0)
        currentX += preciseX
    }
    return placedItems
}
