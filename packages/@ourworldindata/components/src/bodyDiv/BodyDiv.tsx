import * as React from "react"
import ReactDOM from "react-dom"

interface BodyDivProps {
    children: React.ReactNode
    divClassname?: string
}

// Render a component on the Body instead of inside the current Tree.
// https://reactjs.org/docs/portals.html
export class BodyDiv extends React.Component<BodyDivProps> {
    // This used to be created in the constructor and was not nullable but
    // this started to cause issues during the grapher state refactor for unknown reasons
    el: HTMLDivElement | null = null

    constructor(props: BodyDivProps) {
        super(props)
        // Do not access `document` here as it might be undefined (e.g., during SSR)
        // this.el = document.createElement("div") // Removed
    }

    override componentDidMount(): void {
        if (typeof document !== "undefined") {
            this.el = document.createElement("div")
            if (this.props.divClassname)
                this.el.className = this.props.divClassname

            document.body.appendChild(this.el)
            // Force a re-render now that `this.el` is available for the portal
            this.forceUpdate()
        }
    }

    override componentWillUnmount(): void {
        // Remove the element from the body if it was added
        if (this.el && this.el.parentNode === document.body) {
            document.body.removeChild(this.el)
        }
        this.el = null // Clean up the reference
    }

    override render(): React.ReactPortal | null {
        if (!this.el) {
            return null
        }
        return ReactDOM.createPortal(this.props.children, this.el)
    }
}
