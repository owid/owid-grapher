import { extend, defaultTo } from "charts/utils/Util"
import * as React from "react"
import { observable, computed, runInAction, action } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "charts/utils/Bounds"

@observer
export class TooltipView extends React.Component<{
    tooltipOwner: TooltipOwner
    width: number
    height: number
}> {
    @computed get rendered() {
        const { bounds } = this
        const tooltipOwner = this.props.tooltipOwner

        if (!tooltipOwner.tooltip) return null

        const tooltip = tooltipOwner.tooltip

        const offsetX = defaultTo(tooltip.offsetX, 0)
        let offsetY = defaultTo(tooltip.offsetY, 0)
        if (tooltip.offsetYDirection === "upward") {
            offsetY = -offsetY - (bounds?.height ?? 0)
        }

        let x = tooltip.x + offsetX
        let y = tooltip.y + offsetY

        // Ensure tooltip remains inside chart
        if (bounds) {
            if (x + bounds.width > this.props.width)
                x -= bounds.width + 2 * offsetX
            if (y + bounds.height > this.props.height)
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

// We can't pass the property directly because we need it to be observable.
interface TooltipOwner {
    tooltip?: TooltipProps
}

export interface TooltipProps {
    x: number
    y: number
    offsetX?: number
    offsetY?: number
    offsetYDirection?: "upward" | "downward"
    style?: React.CSSProperties
    children?: React.ReactNode
    tooltipOwner: TooltipOwner
}

@observer
export class Tooltip extends React.Component<TooltipProps> {
    componentDidMount() {
        this.componentDidUpdate()
    }

    componentDidUpdate() {
        runInAction(() => (this.props.tooltipOwner.tooltip = this.props))
    }

    componentWillUnmount() {
        runInAction(() => (this.props.tooltipOwner.tooltip = undefined))
    }

    render() {
        return null
    }
}
