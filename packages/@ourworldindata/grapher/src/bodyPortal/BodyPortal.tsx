import React from "react"
import ReactDOM from "react-dom"

interface BodyPortalProps {
    id?: string
    tagName?: string // default: "div"
    children: React.ReactNode
}

// Render a component on the Body instead of inside the current Tree.
// https://reactjs.org/docs/portals.html
export class BodyPortal extends React.Component<BodyPortalProps> {
    el: HTMLElement

    constructor(props: BodyPortalProps) {
        super(props)
        this.el = document.createElement(props.tagName || "div")
        if (props.id) this.el.id = props.id
    }

    componentDidMount(): void {
        document.body.appendChild(this.el)
    }

    componentWillUnmount(): void {
        document.body.removeChild(this.el)
    }

    render(): any {
        return ReactDOM.createPortal(this.props.children, this.el)
    }
}
