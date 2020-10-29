import React, { ReactElement, useState } from "react"
import ReactDOM from "react-dom"
import { GlossaryExcerpt } from "site/GlossaryExcerpt/GlossaryExcerpt"

interface Component {
    [key: string]: any
}
const availableComponents: Component = { GlossaryExcerpt }

// Leave as a function so ExpandableInlineBlock.name resolves
export function ExpandableInlineBlock({
    label,
    children,
}: {
    label: string
    children: ReactElement
}) {
    const [isVisible, setVisible] = useState(false)

    const toggleVisibility = () => setVisible(!isVisible)

    return (
        <span>
            <button onClick={toggleVisibility}>{label}</button>
            {isVisible && <span>{children}</span>}
        </span>
    )
}

export const runExpandableInlineBlock = () => {
    const expandableInlineBlocks = document.querySelectorAll(
        `[data-type=${ExpandableInlineBlock.name}]`
    )
    expandableInlineBlocks.forEach((expandableInlineBlock) => {
        const { label, ...props } = JSON.parse(expandableInlineBlock.innerHTML)
        const subComponent = expandableInlineBlock.getAttribute("data-embedded")
        if (!subComponent) return

        const Component = availableComponents[subComponent]

        ReactDOM.render(
            <ExpandableInlineBlock label={label}>
                <Component {...props} />
            </ExpandableInlineBlock>,
            expandableInlineBlock.parentElement
        )
    })
}
