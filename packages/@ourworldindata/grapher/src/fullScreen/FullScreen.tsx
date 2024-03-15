import React from "react"
import { action } from "mobx"
import { observer } from "mobx-react"
import { BodyDiv } from "../bodyDiv/BodyDiv"

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
            // check if the click was outside of the modal
            !this.content.current.contains(e.target as Node) &&
            // check that the target is still mounted to the document; we also get click events on nodes that have since been removed by React
            document.contains(e.target as Node)
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
