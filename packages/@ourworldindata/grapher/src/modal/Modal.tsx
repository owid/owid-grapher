import * as React from "react"
import { Bounds, bind } from "@ourworldindata/utils"
import {
    isElementInteractive,
    isTargetOutsideElement,
} from "../chart/ChartUtils"

export class Modal extends React.Component<{
    bounds: Bounds
    onDismiss: () => void
    children?: React.ReactNode
    isHeightFixed?: boolean // by default, the modal height is not fixed but fits to the content
    alignVertical?: "top" | "center" | "bottom"
}> {
    contentRef = React.createRef<HTMLDivElement>()

    private get bounds(): Bounds {
        return this.props.bounds
    }

    private get isHeightFixed(): boolean {
        return this.props.isHeightFixed ?? false
    }

    private get alignVertical(): "top" | "center" | "bottom" {
        return this.props.alignVertical ?? "center"
    }

    @bind onDocumentClick(e: MouseEvent): void {
        if (
            this.contentRef?.current &&
            isTargetOutsideElement(e.target!, this.contentRef.current) &&
            // clicking on an interactive element should not dismiss the modal
            // (this is especially important for the suggested chart review tool)
            !isElementInteractive(e.target as HTMLElement)
        )
            this.props.onDismiss()
    }

    @bind onDocumentKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape") this.props.onDismiss()
    }

    override componentDidMount(): void {
        document.addEventListener("click", this.onDocumentClick)
        document.addEventListener("keydown", this.onDocumentKeyDown)
    }

    override componentWillUnmount(): void {
        document.removeEventListener("click", this.onDocumentClick)
        document.removeEventListener("keydown", this.onDocumentKeyDown)
    }

    override render(): React.ReactElement {
        const { bounds } = this

        const contentStyle: React.CSSProperties = {
            left: bounds.left,
            width: bounds.width,
            maxHeight: bounds.height,
        }

        if (this.isHeightFixed) {
            contentStyle.height = bounds.height
        }

        if (this.alignVertical === "bottom") {
            contentStyle.bottom = bounds.y
        } else if (this.alignVertical === "top") {
            contentStyle.top = bounds.y
        } else {
            contentStyle.top = "50%"
            contentStyle.transform = "translateY(-50%)"
        }

        return (
            <div className="modal-overlay">
                <div className="modal-wrapper">
                    <div
                        className="modal-content"
                        style={contentStyle}
                        ref={this.contentRef}
                    >
                        {this.props.children}
                    </div>
                </div>
            </div>
        )
    }
}
