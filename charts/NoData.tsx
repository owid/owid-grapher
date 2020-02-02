import { action } from "mobx"
import { observer } from "mobx-react"
import * as React from "react"

import { faExchangeAlt } from "@fortawesome/free-solid-svg-icons/faExchangeAlt"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Bounds } from "./Bounds"
import { ChartConfig } from "./ChartConfig"
import { ChartView } from "./ChartView"
import { ChartViewContext, ChartViewContextType } from "./ChartViewContext"
import { ControlsOverlay } from "./Controls"

@observer
export class Message extends React.Component<{
    chart: ChartConfig
    chartView: ChartView
    bounds: Bounds
    message?: string
}> {
    @action.bound onDataSelect() {
        this.props.chartView.isSelectingData = true
    }

    render() {
        const { chart, bounds, message } = this.props
        return (
            <div
                className="NoData"
                style={{
                    position: "absolute",
                    top: bounds.top,
                    left: bounds.left,
                    width: bounds.width,
                    height: bounds.height
                }}
            >
                <p className="message">{message || "No available data"}</p>
                <div className="actions">
                    {chart.data.canAddData && (
                        <button className="action" onClick={this.onDataSelect}>
                            <FontAwesomeIcon icon={faPlus} /> Add{" "}
                            {chart.entityType}
                        </button>
                    )}
                    {chart.data.canChangeEntity && (
                        <button className="action" onClick={this.onDataSelect}>
                            <FontAwesomeIcon icon={faExchangeAlt} /> Change{" "}
                            {chart.entityType}
                        </button>
                    )}
                </div>
            </div>
        )
    }
}

@observer
export class NoData extends React.Component<{
    bounds: Bounds
    message?: string
}> {
    static contextType = ChartViewContext
    context!: ChartViewContextType

    render() {
        const { bounds, message } = this.props
        const { chart, chartView } = this.context
        return (
            <ControlsOverlay id="no-data">
                <Message
                    chart={chart}
                    chartView={chartView}
                    bounds={bounds}
                    message={message}
                />
            </ControlsOverlay>
        )
    }
}
