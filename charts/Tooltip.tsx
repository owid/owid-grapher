import { extend, defaultTo } from "./Util"
import * as React from "react"
import { ChartViewContext, ChartViewContextType } from "./ChartViewContext"
import { observable, computed, runInAction } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "./Bounds"

export interface TooltipProps {
    x: number
    y: number
    offsetX?: number
    offsetY?: number
    style?: React.CSSProperties
    children?: React.ReactNode
}

@observer
export class TooltipView extends React.Component {
    static contextType = ChartViewContext
    context!: ChartViewContextType

    @computed get rendered() {
        const { bounds } = this
        const { chartView, chart } = this.context

        if (!chart.tooltip) return null

        const tooltip = chart.tooltip

        const offsetX = defaultTo(tooltip.offsetX, 0)
        const offsetY = defaultTo(tooltip.offsetY, 0)

        let x = tooltip.x + offsetX
        let y = tooltip.y + offsetY

        // Ensure tooltip remains inside chart
        if (bounds) {
            if (x + bounds.width > chartView.renderWidth)
                x -= bounds.width + 2 * offsetX
            if (y + bounds.height > chartView.renderHeight)
                y -= bounds.height + 2 * offsetY
            if (x < 0) x = 0
            if (y < 0) y = 0
        }

        const tooltipStyle: React.CSSProperties = {
            position: "absolute",
            pointerEvents: "none",
            left: `${x}px`,
            top: `${y}px`,
            whiteSpace: "nowrap",
            backgroundColor: "rgba(255,255,255,0.92)",
            boxShadow: "0 2px 2px rgba(0,0,0,.12), 0 0 1px rgba(0,0,0,.35)",
            borderRadius: "2px",
            textAlign: "left",
            fontSize: "0.9em"
        }

        return (
            <div
                ref={this.base}
                className="Tooltip"
                style={extend(tooltipStyle, tooltip.style || {})}
            >
                {tooltip.children}
            </div>
        )
    }

    base: React.RefObject<HTMLDivElement> = React.createRef()

    @observable.struct bounds?: Bounds
    componentDidMount() {
        this.componentDidUpdate()
    }
    componentDidUpdate() {
        runInAction(() => {
            if (this.base.current)
                this.bounds = Bounds.fromElement(this.base.current)
        })
    }

    render() {
        return this.rendered
    }
}

@observer
export class Tooltip extends React.Component<TooltipProps> {
    static contextType = ChartViewContext
    context!: ChartViewContextType

    componentDidMount() {
        this.componentDidUpdate()
    }

    componentDidUpdate() {
        runInAction(() => (this.context.chart.tooltip = this.props))
    }

    componentWillUnmount() {
        runInAction(() => (this.context.chart.tooltip = undefined))
    }

    render() {
        return null
    }
}
