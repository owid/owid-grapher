import {
    EntityName,
    GRAPHER_CHART_TYPES,
    GrapherChartType,
    GrapherValuesJson,
    GrapherValuesJsonDataPoint,
    GridSlotKey,
    LargeVariantGridSlotKey,
    MediumVariantGridSlotKey,
    SearchChartHitDataDisplayProps,
} from "@ourworldindata/types"
import { match } from "ts-pattern"
import { getRegionByName } from "../regions"
import { calculateTrendDirection, getDisplayUnit } from "../Util.js"

export function buildChartHitDataDisplayProps({
    chartInfo,
    chartType,
    entity,
    isEntityPickedByUser,
}: {
    chartInfo?: GrapherValuesJson | null
    chartType?: GrapherChartType
    entity: EntityName
    isEntityPickedByUser?: boolean
}): SearchChartHitDataDisplayProps | undefined {
    if (!chartInfo) return undefined

    // Showing a time range only makes sense for slope charts and connected scatter plots
    const showTimeRange =
        chartType === GRAPHER_CHART_TYPES.SlopeChart ||
        chartType === GRAPHER_CHART_TYPES.ScatterPlot

    const endDatapoint = findDatapoint(chartInfo, "end")
    const startDatapoint = showTimeRange
        ? findDatapoint(chartInfo, "start")
        : undefined
    const columnInfo = endDatapoint?.columnSlug
        ? chartInfo?.columns?.[endDatapoint?.columnSlug]
        : undefined

    if (!endDatapoint?.formattedValueShort || !endDatapoint?.formattedTime)
        return undefined

    // For scatter plots, displaying a single data value is ambiguous since
    // they have two dimensions. But we do show a data value if the x axis
    // is GDP since then it's sufficiently clear
    const xSlug = chartInfo?.endValues?.x?.columnSlug
    const xColumnInfo = chartInfo?.columns?.[xSlug ?? ""]
    const hasDataDisplay =
        chartType !== GRAPHER_CHART_TYPES.ScatterPlot ||
        /GDP/.test(xColumnInfo?.name ?? "")

    if (!hasDataDisplay) return undefined

    const endValue = endDatapoint.valueLabel ?? endDatapoint.formattedValueShort
    const startValue =
        startDatapoint?.valueLabel ?? startDatapoint?.formattedValueShort
    const unit = columnInfo ? getDisplayUnit(columnInfo) : undefined
    const time = startDatapoint?.formattedTime
        ? `${startDatapoint?.formattedTime}–${endDatapoint.formattedTime}`
        : endDatapoint.formattedTime
    const trend = calculateTrendDirection(
        startDatapoint?.value,
        endDatapoint?.value
    )
    const showLocationIcon =
        isEntityPickedByUser && getRegionByName(entity) !== undefined

    return {
        entityName: entity,
        endValue,
        startValue,
        time,
        unit,
        trend,
        showLocationIcon,
    }
}

function findDatapoint(
    chartInfo: GrapherValuesJson | undefined,
    time: "end" | "start" = "end"
): GrapherValuesJsonDataPoint | undefined {
    if (!chartInfo) return undefined

    const yDims = match(time)
        .with("end", () => chartInfo.endValues?.y)
        .with("start", () => chartInfo.startValues?.y)
        .exhaustive()
    if (!yDims) return undefined

    // Make sure we're not showing a projected data point
    const historicalDims = yDims.filter(
        (dim) => !chartInfo.columns?.[dim.columnSlug]?.isProjection
    )

    // Don't show a data value for charts with multiple y-indicators
    if (historicalDims.length > 1) return undefined

    return historicalDims[0]
}

export function getTableColumnCountForGridSlotKey(slot: GridSlotKey): number {
    return (
        match(slot)
            // medium variant grid slots
            .with(MediumVariantGridSlotKey.Single, () => 1)
            .with(MediumVariantGridSlotKey.Double, () => 2)
            .with(MediumVariantGridSlotKey.Triple, () => 3)
            .with(MediumVariantGridSlotKey.Quad, () => 4)
            .with(MediumVariantGridSlotKey.SmallLeft, () => 1)
            .with(MediumVariantGridSlotKey.SmallRight, () => 1)

            // large variant grid slots
            .with(LargeVariantGridSlotKey.LeftQuad, () => 2)
            .with(LargeVariantGridSlotKey.RightQuad, () => 2)
            .with(LargeVariantGridSlotKey.RightQuadLeftColumn, () => 1)
            .with(LargeVariantGridSlotKey.SingleCell, () => 0.5)
            .with(LargeVariantGridSlotKey.TopRightCell, () => 0.5)
            .with(LargeVariantGridSlotKey.BottomRightCell, () => 0.5)
            .with(LargeVariantGridSlotKey.RightQuadBottomRow, () => 2)
            .with(LargeVariantGridSlotKey.Full, () => 4)
            .exhaustive()
    )
}
