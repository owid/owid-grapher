import * as React from "react"
import { action } from "mobx"
import { observer } from "mobx-react"
import { BodyDiv } from "../bodyDiv/BodyDiv"
import { isTargetOutsideElement } from "../chart/ChartUtils"

@observer
export class FullScreen extends React.Component<{
    children: React.ReactNode
    onDismiss: () => void
    overlayColor?: string
}> {
    content: React.RefObject<HTMLDivElement> = React.createRef()

    @action.bound onDocumentClick(e: React.MouseEvent): void {
        if (
            this.content?.current &&
            isTargetOutsideElement(e.target, this.content.current)
        )
            this.props.onDismiss()
    }

    @action.bound onDocumentKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape") this.props.onDismiss()
    }

    componentDidMount(): void {
        document.addEventListener("keydown", this.onDocumentKeyDown)
    }

    componentWillUnmount(): void {
        document.removeEventListener("keydown", this.onDocumentKeyDown)
    }

    render() {
        return (
            <BodyDiv>
                <div
                    className="FullScreenOverlay"
                    role="dialog"
                    aria-modal="true"
                    onClick={this.onDocumentClick}
                    style={{
                        backgroundColor: this.props.overlayColor ?? "#fff",
                    }}
                >
                    <div className="FullScreenContent" ref={this.content}>
                        {this.props.children}
                    </div>
                </div>
            </BodyDiv>
        )
    }
}
