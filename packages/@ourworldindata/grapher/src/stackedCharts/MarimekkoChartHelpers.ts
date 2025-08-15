import { HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { AxisConfig } from "../axis/AxisConfig"
import { MarimekkoChartState } from "./MarimekkoChartState"

export function toHorizontalAxis(
    config: AxisConfig,
    chartState: MarimekkoChartState
): HorizontalAxis {
    let axis = config.toHorizontalAxis()
    if (chartState.manager.isRelativeMode && chartState.xColumn) {
        // MobX and classes  interact in an annoying way here so we have to construct a new object via
        // an object copy of the AxisConfig class instance to be able to set a property without
        // making MobX unhappy about a mutation originating from a computed property
        axis = new HorizontalAxis(
            new AxisConfig(
                { ...config.toObject(), maxTicks: 10 },
                config.axisManager
            ),
            config.axisManager
        )
        axis.domain = [0, 100]
    } else axis.updateDomainPreservingUserSettings(chartState.xDomainDefault)

    axis.formatColumn = chartState.xColumn

    axis.label = chartState.horizontalAxisLabel

    return axis
}

export function toVerticalAxis(
    config: AxisConfig,
    chartState: MarimekkoChartState
): VerticalAxis {
    const axis = config.toVerticalAxis()
    axis.updateDomainPreservingUserSettings(chartState.yDomainDefault)

    axis.formatColumn = chartState.yColumns[0]
    axis.label = ""

    return axis
}
