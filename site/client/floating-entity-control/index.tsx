import * as React from "react"
import * as ReactDOM from "react-dom"
import { GlobalEntitySelection } from "../GlobalEntitySelection"
import { FloatingEntityControl } from "./FloatingEntityControl"

export function runFloatingEntityControl(
    globalEntitySelection: GlobalEntitySelection
) {
    const element = document.querySelector("*[data-floating-entity-control]")
    if (element) {
        element.classList.add("floating-entity-control-container")
        ReactDOM.render(
            <FloatingEntityControl
                globalEntitySelection={globalEntitySelection}
            />,
            element
        )
    }
}
