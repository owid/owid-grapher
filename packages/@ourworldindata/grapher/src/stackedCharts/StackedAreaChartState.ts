import * as _ from "lodash-es"
import { computed, makeObservable } from "mobx"
import { AbstractStackedChartState } from "./AbstractStackedChartState.js"
import { ChartState } from "../chart/ChartInterface.js"
import { StackedSeries } from "./StackedConstants.js"
import { stackSeries, withMissingValuesAsZeroes } from "./StackedUtils.js"
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
        return stackSeries(withMissingValuesAsZeroes(this.unstackedSeries))
    }

    @computed get yDomain(): [number, number] {
        const yValues = this.allStackedPoints.map(
            (point) => point.value + point.valueOffset
        )
        return [0, _.max(yValues) ?? 0]
    }
}
