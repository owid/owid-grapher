import * as _ from "lodash-es"
import { computed, makeObservable } from "mobx"
import { AbstractStackedChartState } from "./AbstractStackedChartState.js"
import { ChartState } from "../chart/ChartInterface.js"
import { StackedSeries } from "./StackedConstants.js"
import { TimeColumn } from "@ourworldindata/core-table"
import {
    stackSeriesInBothDirections,
    withMissingValuesAsZeroes,
} from "./StackedUtils.js"
import { ColorScaleManager } from "../color/ColorScale.js"
import {
    ColorScaleConfigInterface,
    ColorSchemeName,
    ColumnTypeNames,
} from "@ourworldindata/types"
import { ChartManager } from "../chart/ChartManager.js"

// Whether daily data should get uniform spacing (one filler per missing day).
// Disabled during the transition to explicit time intervals: weekly indicators
// are currently still marked as daily, and spacing them at daily granularity
// would be wrong. Flip to `true` once those indicators use timeInterval "week".
const ENABLE_DAILY_UNIFORM_SPACING = false

export class StackedBarChartState
    extends AbstractStackedChartState
    implements ChartState, ColorScaleManager
{
    constructor(props: { manager: ChartManager }) {
        super(props)
        makeObservable(this)
    }

    shouldRunLinearInterpolation = false

    defaultBaseColorScheme = ColorSchemeName.stackedAreaDefault

    @computed
    get unstackedSeriesWithMissingValuesAsZeroes(): StackedSeries<number>[] {
        // Fill gaps with zeroes so bars are evenly spaced. Each time column
        // knows how to space its own encoding. Daily data is skipped for
        // now — see ENABLE_DAILY_UNIFORM_SPACING.
        const { timeColumn } = this.transformedTable
        const columnType = timeColumn.def.type
        const isDayEncoded =
            columnType === ColumnTypeNames.Day ||
            columnType === ColumnTypeNames.Date

        if (
            timeColumn instanceof TimeColumn &&
            (ENABLE_DAILY_UNIFORM_SPACING || !isDayEncoded)
        ) {
            return withMissingValuesAsZeroes(this.unstackedSeries, {
                enforceUniformSpacing: true,
                timeColumn,
            })
        }

        return withMissingValuesAsZeroes(this.unstackedSeries)
    }

    @computed get series(): readonly StackedSeries<number>[] {
        return stackSeriesInBothDirections(
            this.unstackedSeriesWithMissingValuesAsZeroes
        )
    }

    @computed get xValues(): number[] {
        return _.uniq(
            this.unstackedSeriesWithMissingValuesAsZeroes.flatMap((s) =>
                s.points.map((p) => p.position)
            )
        )
    }

    /** Colour positive and negative values differently in stacked bar charts */
    @computed get useValueBasedColorScheme(): boolean {
        // Switched on externally, e.g. in a faceted chart
        if (this.manager.useValueBasedColorScheme) return true

        // Check if there is only one series and that series has both positive and negative values
        return (
            this.rawSeries.length === 1 &&
            this.rawSeries[0].rows.some((row) => row.value < 0) &&
            this.rawSeries[0].rows.some((row) => row.value > 0)
        )
    }

    @computed get colorScaleConfig(): ColorScaleConfigInterface | undefined {
        return this.manager.colorScale
    }

    @computed get yDomain(): [number, number] {
        const yValues = this.allStackedPoints.map(
            (point) => point.value + point.valueOffset
        )
        return [_.min([0, ...yValues]) ?? 0, _.max([0, ...yValues]) ?? 0]
    }
}
