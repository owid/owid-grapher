import React from "react"
import { observable, computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "../../clientUtils/Bounds.js"
import { TooltipProps, TooltipManager } from "./TooltipProps.js"

const TooltipCard = observer(
    class TooltipCard extends React.Component<
        TooltipProps & {
            containerWidth: number
            containerHeight: number
            bounds?: Bounds
        }
    > {
        private base: React.RefObject<HTMLDivElement> = React.createRef()

        private bounds?: Bounds

        constructor(
            props: TooltipProps & {
                containerWidth: number
                containerHeight: number
                bounds?: Bounds
            }
        ) {
            super(props)

            makeObservable<TooltipCard, "bounds" | "updateBounds">(this, {
                bounds: observable.struct,
                updateBounds: action.bound,
            })
        }

        private updateBounds(): void {
            if (this.base.current)
                this.bounds = Bounds.fromElement(this.base.current)
        }

        componentDidMount(): void {
            this.updateBounds()
        }

        componentDidUpdate(): void {
            this.updateBounds()
        }

        render(): JSX.Element {
            const offsetX = this.props.offsetX ?? 0
            let offsetY = this.props.offsetY ?? 0
            if (this.props.offsetYDirection === "upward") {
                offsetY = -offsetY - (this.bounds?.height ?? 0)
            }

            let x = this.props.x + offsetX
            let y = this.props.y + offsetY

            // Ensure tooltip remains inside chart
            if (this.bounds) {
                if (x + this.bounds.width > this.props.containerWidth)
                    x -= this.bounds.width + 2 * offsetX
                if (y + this.bounds.height > this.props.containerHeight)
                    y -= this.bounds.height + 2 * offsetY
                if (x < 0) x = 0
                if (y < 0) y = 0
            }

            const style: React.CSSProperties = {
                position: "absolute",
                pointerEvents: "none",
                left: `${x}px`,
                top: `${y}px`,
                whiteSpace: "nowrap",
                backgroundColor: "rgba(255,255,255,0.95)",
                boxShadow: "0 2px 2px rgba(0,0,0,.12), 0 0 1px rgba(0,0,0,.35)",
                borderRadius: "2px",
                textAlign: "left",
                fontSize: "0.9em",
                ...this.props.style,
            }
            return (
                <div ref={this.base} className="Tooltip" style={style}>
                    {this.props.children}
                </div>
            )
        }
    }
)

export const TooltipContainer = observer(
    class TooltipContainer extends React.Component<{
        tooltipProvider: TooltipManager
        containerWidth: number
        containerHeight: number
    }> {
        constructor(props: {
            tooltipProvider: TooltipManager
            containerWidth: number
            containerHeight: number
        }) {
            super(props)

            makeObservable<TooltipContainer, "rendered">(this, {
                rendered: computed,
            })
        }

        private get rendered(): JSX.Element | null {
            const tooltipsMap = this.props.tooltipProvider.tooltips
            if (!tooltipsMap) return null
            const tooltips = Object.entries(tooltipsMap.toJSON())
            return (
                <div className="tooltip-container">
                    {tooltips.map(([id, tooltip]) => (
                        <TooltipCard
                            {...tooltip}
                            key={id}
                            containerWidth={this.props.containerWidth}
                            containerHeight={this.props.containerHeight}
                        />
                    ))}
                </div>
            )
        }

        render(): JSX.Element | null {
            return this.rendered
        }
    }
)

export const Tooltip = observer(
    class Tooltip extends React.Component<TooltipProps> {
        constructor(props: TooltipProps) {
            super(props)

            makeObservable<
                Tooltip,
                "connectTooltipToContainer" | "removeToolTipFromContainer"
            >(this, {
                connectTooltipToContainer: action.bound,
                removeToolTipFromContainer: action.bound,
            })
        }

        componentDidMount(): void {
            this.connectTooltipToContainer()
        }

        private connectTooltipToContainer(): void {
            this.props.tooltipManager.tooltips?.set(this.props.id, this.props)
        }

        private removeToolTipFromContainer(): void {
            this.props.tooltipManager.tooltips?.delete(this.props.id)
        }

        componentDidUpdate(): void {
            this.connectTooltipToContainer()
        }

        componentWillUnmount(): void {
            this.removeToolTipFromContainer()
        }

        render(): null {
            return null
        }
    }
)
