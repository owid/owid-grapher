import { observer } from "mobx-react"
import React from "react"
import {
    ChartViewContext,
    ChartViewContextType
} from "charts/core/ChartViewContext"
import { action } from "mobx"

@observer
export class ControlsOverlay extends React.Component<{
    id: string
    children: JSX.Element
    paddingTop?: number
    paddingRight?: number
    paddingBottom?: number
    paddingLeft?: number
}> {
    static contextType = ChartViewContext
    context!: ChartViewContextType

    componentDidMount() {
        // todo: remove context
        if (this.context?.chartView)
            this.context.chartView.overlays[this.props.id] = this
    }

    @action.bound deleteOverlay() {
        // todo: remove context
        delete this.context?.chartView?.overlays[this.props.id]
    }

    componentWillUnmount() {
        this.deleteOverlay()
    }

    render() {
        return null
    }
}
