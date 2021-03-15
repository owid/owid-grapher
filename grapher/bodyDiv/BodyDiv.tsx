import React from "react"
import ReactDOM from "react-dom"

// Render a component on the Body instead of inside the current Tree.
// https://reactjs.org/docs/portals.html
export class BodyDiv extends React.Component {
    constructor(props: any) {
        super(props)
        this.el = document.createElement("div")
    }

    el: HTMLDivElement

    componentDidMount() {
        document.body.appendChild(this.el)
    }

    componentWillUnmount() {
        document.body.removeChild(this.el)
    }

    render() {
        return ReactDOM.createPortal(this.props.children, this.el)
    }
}
