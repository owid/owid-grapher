import { computed } from "mobx"
import { AbstractStackedChartState } from "./AbstractStackedChartState.js"
import { ChartState } from "../chart/ChartInterface.js"
import { StackedSeries } from "./StackedConstants.js"
import { ColumnTypeMap } from "@ourworldindata/core-table"
import {
    stackSeriesInBothDirections,
    withMissingValuesAsZeroes,
} from "./StackedUtils.js"
import { ColorScaleManager } from "../color/ColorScale.js"
import { ColorScaleConfigDefaults } from "../color/ColorScaleConfig.js"
import { ColorSchemeName } from "@ourworldindata/types"

export class StackedBarChartState
    extends AbstractStackedChartState
    implements ChartState, ColorScaleManager
{
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

    @computed get colorScaleConfig(): ColorScaleConfigDefaults | undefined {
        return this.manager.colorScale
    }
}
