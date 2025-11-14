import * as React from "react"
import { Bounds, bind } from "@ourworldindata/utils"

export type ModalVerticalAlignment = "top" | "center" | "bottom"

export interface ModalProps {
    bounds: Bounds
    onDismiss: () => void
    children?: React.ReactNode
    isHeightFixed?: boolean
    alignVertical?: ModalVerticalAlignment
    /** Additional selectors (e.g., class names) treated as interactive. */
    interactiveElementSelectors?: string[]
}

export class Modal extends React.Component<ModalProps> {
    private contentRef = React.createRef<HTMLDivElement>()

    private get bounds(): Bounds {
        return this.props.bounds
    }

    private get isHeightFixed(): boolean {
        return this.props.isHeightFixed ?? false
    }

    private get alignVertical(): ModalVerticalAlignment {
        return this.props.alignVertical ?? "center"
    }

    private get interactiveSelector(): string | undefined {
        const selectors = [
            "a",
            "button",
            "input",
            ...(this.props.interactiveElementSelectors ?? []),
        ]
        return selectors.length ? selectors.join(", ") : undefined
    }

    private isElementInteractive(element: HTMLElement): boolean {
        const selector = this.interactiveSelector
        return selector ? element.closest(selector) !== null : false
    }

    private isTargetOutsideElement(target: EventTarget, element: Node): boolean {
        const targetNode = target as Node
        if (typeof document === "undefined") return !element.contains(targetNode)
        return (
            !element.contains(targetNode) && document.contains(targetNode)
        )
    }

    @bind private onDocumentClick(e: MouseEvent): void {
        if (
            this.contentRef.current &&
            this.isTargetOutsideElement(e.target!, this.contentRef.current) &&
            // clicking on an interactive element should not dismiss the modal
            !this.isElementInteractive(e.target as HTMLElement)
        )
            this.props.onDismiss()
    }

    @bind private onDocumentKeyDown(e: KeyboardEvent): void {
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

        if (this.isHeightFixed) contentStyle.height = bounds.height

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
