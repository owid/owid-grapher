import * as _ from "lodash-es"
import { computed, makeObservable } from "mobx"
import { AbstractStackedChartState } from "./AbstractStackedChartState.js"
import { ChartState } from "../chart/ChartInterface.js"
import { StackedSeries } from "./StackedConstants.js"
import { ColumnTypeMap } from "@ourworldindata/core-table"
import {
    stackSeriesInBothDirections,
    withMissingValuesAsZeroes,
} from "./StackedUtils.js"
import { ColorScaleManager } from "../color/ColorScale.js"
import {
    ColorScaleConfigInterface,
    ColorSchemeName,
} from "@ourworldindata/types"
import { ChartManager } from "../chart/ChartManager.js"

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
        // TODO: remove once monthly data is supported (https://github.com/owid/owid-grapher/issues/2007)
        const enforceUniformSpacing = !(
            this.transformedTable.timeColumn instanceof ColumnTypeMap.Day
        )

        return withMissingValuesAsZeroes(this.unstackedSeries, {
            enforceUniformSpacing,
        })
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
