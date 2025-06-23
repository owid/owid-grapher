import * as React from "react"
import { computed, action } from "mobx"
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
    position?: {
        top: number
        bottom: number
        right: number
    }
}

@observer
export class Popover extends React.Component<PopoverProps> {
    private contentRef: React.RefObject<HTMLDivElement> = React.createRef()

    @computed private get isOpen(): boolean {
        return this.props.isOpen
    }

    @computed private get layout():
        | {
              maxHeight: string
              maxWidth: string
              top: number
              right: number
          }
        | undefined {
        const { position } = this.props
        if (!position) return undefined

        const { top, bottom, right } = position
        const maxHeight = `calc(100% - ${top + bottom}px)`
        const maxWidth = `calc(100% - ${2 * right}px)`

        return { maxHeight, maxWidth, top, right }
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
                className={classnames("popover", className)}
                ref={this.contentRef}
            >
                <div
                    className="popover__backdrop"
                    onClick={this.props.onClose}
                />
                <div className="popover__wrapper" style={this.layout}>
                    {title && (
                        <OverlayHeader
                            className="popover__header"
                            title={title}
                            onDismiss={this.props.onClose}
                        />
                    )}
                    <div className="popover__content">{children}</div>
                </div>
            </div>
        )
    }
}
