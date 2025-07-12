import { computed } from "mobx"
import { AbstractStackedChartState } from "./AbstractStackedChartState.js"
import { ChartState } from "../chart/ChartInterface.js"
import { StackedSeries } from "./StackedConstants.js"
import { stackSeries, withMissingValuesAsZeroes } from "./StackedUtils.js"

export class StackedAreaChartState
    extends AbstractStackedChartState
    implements ChartState
{
    shouldRunLinearInterpolation = true

    @computed get series(): readonly StackedSeries<number>[] {
        return stackSeries(withMissingValuesAsZeroes(this.unstackedSeries))
    }

    @computed get useValueBasedColorScheme(): boolean {
        return false
    }
}
