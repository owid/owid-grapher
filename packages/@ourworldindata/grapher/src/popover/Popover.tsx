import * as React from "react"
import { computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { isTargetOutsideElement } from "../chart/ChartUtils.js"
import { OverlayHeader } from "@ourworldindata/components"

export interface PopoverProps {
    children: React.ReactNode
    title?: string
    isOpen: boolean
    onClose: () => void
    className?: string
    style?: React.CSSProperties
}

@observer
export class Popover extends React.Component<PopoverProps> {
    private contentRef: React.RefObject<HTMLDivElement> = React.createRef()

    constructor(props: PopoverProps) {
        super(props)
        makeObservable(this)
    }

    @computed private get isOpen(): boolean {
        return this.props.isOpen
    }

    componentDidMount(): void {
        document.addEventListener("keydown", this.onDocumentKeyDown)
        document.addEventListener("click", this.onDocumentClick, {
            capture: true,
        })
    }

    componentWillUnmount(): void {
        document.removeEventListener("keydown", this.onDocumentKeyDown)
        document.removeEventListener("click", this.onDocumentClick, {
            capture: true,
        })
    }

    @action.bound private onDocumentKeyDown(e: KeyboardEvent): void {
        // dismiss popover on esc
        if (this.isOpen && e.key === "Escape") {
            this.props.onClose()
        }
    }

    @action.bound private onDocumentClick(e: MouseEvent): void {
        if (
            this.isOpen &&
            this.contentRef?.current &&
            isTargetOutsideElement(e.target!, this.contentRef.current)
        ) {
            this.props.onClose()
        }
    }

    render(): React.ReactElement | null {
        if (!this.isOpen) return null

        const { title, children, className } = this.props

        return (
            <div
                className={classnames("GrapherPopover", className)}
                ref={this.contentRef}
            >
                <div
                    className="GrapherPopover__backdrop"
                    onClick={this.props.onClose}
                />
                <div
                    className="GrapherPopover__wrapper"
                    style={this.props.style}
                >
                    {title && (
                        <OverlayHeader
                            className="GrapherPopover__header"
                            title={title}
                            onDismiss={this.props.onClose}
                        />
                    )}
                    <div className="GrapherPopover__content">{children}</div>
                </div>
            </div>
        )
    }
}
