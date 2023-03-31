import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import React, { useState } from "react"
import AnimateHeight from "react-animate-height"

export const ExpandableAnimatedToggle = ({
    label,
    content,
}: {
    label: string
    content: any
}) => {
    const [height, setHeight] = useState<"auto" | 0>(0)

    const toggle = () => {
        setHeight(height === 0 ? "auto" : 0)
    }

    return (
        <div className="ExpandableAnimatedToggle">
            <button onClick={toggle}>
                <h4>{label}</h4>
                <FontAwesomeIcon icon={faPlus} />
            </button>
            <AnimateHeight height={height} animateOpacity>
                <div
                    className="content"
                    dangerouslySetInnerHTML={{ __html: content }}
                />
            </AnimateHeight>
        </div>
    )
}
