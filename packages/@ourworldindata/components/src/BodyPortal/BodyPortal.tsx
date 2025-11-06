import * as React from "react"
import ReactDOM from "react-dom"

interface BodyPortalProps {
    children: React.ReactNode
    containerClassName?: string
}

/**
 * Renders a component on Body instead of inside the current tree.
 * See https://react.dev/reference/react-dom/createPortal
 */
export class BodyPortal extends React.Component<BodyPortalProps> {
    private element: HTMLDivElement | null = null

    override componentDidMount(): void {
        if (typeof document !== "undefined") {
            this.element = document.createElement("div")
            if (this.props.containerClassName)
                this.element.className = this.props.containerClassName

            document.body.appendChild(this.element)
            // Force a re-render now that `this.el` is available for the portal
            this.forceUpdate()
        }
    }

    override componentWillUnmount(): void {
        // Remove the element from the body if it was added
        if (this.element && this.element.parentNode === document.body) {
            document.body.removeChild(this.element)
        }
        this.element = null // Clean up the reference
    }

    override render(): React.ReactPortal | null {
        if (!this.element) return null
        return ReactDOM.createPortal(this.props.children, this.element)
    }
}
