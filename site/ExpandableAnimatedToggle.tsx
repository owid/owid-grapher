import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import React, { useState } from "react"
import AnimateHeight from "react-animate-height"

export const ExpandableAnimatedToggle = ({
    label,
    content,
    isExpandedDefault = false,
}: {
    label: string
    content?: React.ReactNode
    isExpandedDefault?: boolean
}) => {
    const [height, setHeight] = useState<"auto" | 0>(
        isExpandedDefault ? "auto" : 0
    )

    const toggle = () => {
        setHeight(height === 0 ? "auto" : 0)
    }

    return (
        <div className="ExpandableAnimatedToggle">
            <button onClick={toggle}>
                <h4>{label}</h4>
                <FontAwesomeIcon
                    className="ExpandableAnimatedToggle__icon"
                    icon={faPlus}
                />
            </button>
            <AnimateHeight height={height} animateOpacity>
                <div className="content-wrapper">{content}</div>
            </AnimateHeight>
        </div>
    )
}
