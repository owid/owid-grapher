import * as React from "react"
import { action } from "mobx"
import { observer } from "mobx-react"
import { ScaleType } from "@ourworldindata/types"
import { AxisConfig } from "../../axis/AxisConfig"
import classnames from "classnames"

interface AxisScaleToggleProps {
    axis: AxisConfig
    subtitle?: string
    prefix?: string
}

@observer
export class AxisScaleToggle extends React.Component<AxisScaleToggleProps> {
    @action.bound private setAxisScale(scale: ScaleType): void {
        this.props.axis.scaleType = scale
    }

    render(): React.ReactElement {
        const { linear, log } = ScaleType,
            { axis, prefix, subtitle } = this.props,
            isLinear = axis.scaleType === linear,
            label = prefix ? `${prefix}: ` : undefined

        return (
            <>
                <div className="config-toggle">
                    {subtitle && <label>{subtitle}</label>}
                    <button
                        className={classnames({ active: isLinear })}
                        onClick={(): void => this.setAxisScale(linear)}
                        data-track-note="chart_toggle_scale"
                    >
                        {label}Linear
                    </button>
                    <button
                        className={classnames({ active: !isLinear })}
                        onClick={(): void => this.setAxisScale(log)}
                        data-track-note="chart_toggle_scale"
                    >
                        {label}Logarithmic
                    </button>
                </div>
            </>
        )
    }
}
