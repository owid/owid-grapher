import React from "react"
import { observer } from "mobx-react"
import { action } from "mobx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faTimes } from "@fortawesome/free-solid-svg-icons"

export const ModalContext = React.createContext<{ onDismiss?: () => void }>({})

@observer
export class Modal extends React.Component<{
    onDismiss: () => void
    children?: React.ReactNode
}> {
    base: React.RefObject<HTMLDivElement> = React.createRef()

    @action.bound onDocumentClick(e: MouseEvent): void {
        // check if the click was outside of the modal
        if (
            this.base?.current &&
            !this.base.current.contains(e.target as Node) &&
            // check that the target is still mounted to the document; we also get click events on nodes that have since been removed by React
            document.contains(e.target as Node)
        )
            this.props.onDismiss()
    }

    componentDidMount(): void {
        document.addEventListener("click", this.onDocumentClick)
    }

    componentWillUnmount(): void {
        document.removeEventListener("click", this.onDocumentClick)
    }

    @action.bound onOverlayKeyDown(e: React.KeyboardEvent<HTMLElement>): void {
        if (e.key === "Escape") this.props.onDismiss()
    }

    render(): JSX.Element {
        return (
            <div className="modalOverlay" onKeyDown={this.onOverlayKeyDown}>
                <div className="modalContent" ref={this.base}>
                    <button
                        className="modalDismiss"
                        onClick={this.props.onDismiss}
                    >
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                    <ModalContext.Provider
                        value={{ onDismiss: this.props.onDismiss }}
                    >
                        {this.props.children}
                    </ModalContext.Provider>
                </div>
            </div>
        )
    }
}
