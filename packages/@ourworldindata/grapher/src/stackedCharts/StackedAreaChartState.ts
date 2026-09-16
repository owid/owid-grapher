import { computed, makeObservable } from "mobx"
import { AbstractStackedChartState } from "./AbstractStackedChartState.js"
import { ChartState } from "../chart/ChartInterface.js"
import { StackedSeries } from "./StackedConstants.js"
import {
    findLoneNegativeSeriesAtBottom,
    stackSeries,
    stackSeriesInBothDirections,
    withMissingValuesAsZeroes,
} from "./StackedUtils.js"
import { ChartManager } from "../chart/ChartManager.js"

export class StackedAreaChartState
    extends AbstractStackedChartState
    implements ChartState
{
    constructor(props: { manager: ChartManager }) {
        super(props)
        makeObservable(this)
    }

    shouldRunLinearInterpolation = true

    @computed get useValueBasedColorScheme(): boolean {
        return false
    }

    @computed get series(): readonly StackedSeries<number>[] {
        const series = withMissingValuesAsZeroes(this.unstackedSeries)
        return findLoneNegativeSeriesAtBottom(series)
            ? stackSeriesInBothDirections(series)
            : stackSeries(series)
    }
}
