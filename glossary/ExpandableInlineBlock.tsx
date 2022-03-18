import React, { ReactElement, useState } from "react"
import ReactDOM from "react-dom"
import { GlossaryExcerpt } from "./GlossaryExcerpt.js"

interface Component {
    [key: string]: any
}
const availableComponents: Component = { GlossaryExcerpt }
export const ExpandableInlineBlock_name = "ExpandableInlineBlock"

export const ExpandableInlineBlock = ({
    label,
    type,
    children,
}: {
    label: string
    type: string
    children: ReactElement
}) => {
    const [isVisible, setVisible] = useState(false)

    const toggleVisibility = () => setVisible(!isVisible)

    return (
        <span className="expandable-inline-block">
            <button
                data-track-note={`${type.toLowerCase()}-toggle`}
                onClick={toggleVisibility}
            >
                {label}
            </button>
            {isVisible && <span>{children}</span>}
        </span>
    )
}

export const runExpandableInlineBlock = () => {
    const expandableInlineBlocks = document.querySelectorAll(
        `[data-type=${ExpandableInlineBlock_name}]`
    )
    expandableInlineBlocks.forEach((expandableInlineBlock) => {
        const props = JSON.parse(expandableInlineBlock.innerHTML)
        const subComponent = expandableInlineBlock.getAttribute("data-block")
        const label = expandableInlineBlock.getAttribute("data-label")
        if (!subComponent || !label || !props) return

        const Component = availableComponents[subComponent]

        ReactDOM.render(
            <ExpandableInlineBlock label={label} type={subComponent}>
                <Component {...props} label={label} />
            </ExpandableInlineBlock>,
            expandableInlineBlock.parentElement
        )
    })
}
