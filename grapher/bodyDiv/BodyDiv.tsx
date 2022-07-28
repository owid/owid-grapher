import React from "react"
import ReactDOM from "react-dom"

interface BodyDivProps {
    children: React.ReactNode
    [k: string]: unknown
}

// Render a component on the Body instead of inside the current Tree.
// https://reactjs.org/docs/portals.html
export class BodyDiv extends React.Component<BodyDivProps> {
    constructor(props: BodyDivProps) {
        super(props)
        this.el = document.createElement("div")
    }

    el: HTMLDivElement

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
