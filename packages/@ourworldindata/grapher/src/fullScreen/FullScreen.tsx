import React from "react"
import { action } from "mobx"
import { observer } from "mobx-react"
import { BodyDiv } from "../bodyDiv/BodyDiv"

@observer
export class FullScreen extends React.Component<{
    children: React.ReactNode
    onDismiss: () => void
}> {
    overlay: React.RefObject<HTMLDivElement> = React.createRef()

    componentDidMount(): void {
        this.overlay.current?.focus()
    }

    componentWillUnmount(): void {
        this.overlay.current?.blur()
    }

    @action.bound onKeyDown(e: React.KeyboardEvent<HTMLElement>): void {
        if (e.key === "Escape") this.props.onDismiss()
    }

    render() {
        return (
            <BodyDiv>
                <div
                    ref={this.overlay}
                    className="FullScreen"
                    role="dialog"
                    aria-modal="true"
                    tabIndex={-1}
                    onKeyDown={this.onKeyDown}
                >
                    {this.props.children}
                </div>
            </BodyDiv>
        )
    }
}
