import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import React, { useState } from "react"
import cx from "classnames"

export const ExpandableAnimatedToggle = ({
    label,
    content,
    isExpandedDefault = false,
    isStacked = false,
}: {
    label: string
    content?: React.ReactNode
    isExpandedDefault?: boolean
    isStacked?: boolean
}) => {
    const [isOpen, setOpen] = useState(isExpandedDefault)

    const toggle = () => {
        setOpen(!isOpen)
    }

    return (
        <div
            className={cx("ExpandableAnimatedToggle", {
                "ExpandableAnimatedToggle--stacked": isStacked,
            })}
        >
            <button onClick={toggle}>
                <h4>{label}</h4>
                <FontAwesomeIcon
                    className="ExpandableAnimatedToggle__icon"
                    icon={!isOpen ? faPlus : faMinus}
                />
            </button>
            <div
                className={cx("ExpandableAnimatedToggle__content", {
                    "ExpandableAnimatedToggle__content--open": isOpen,
                })}
            >
                {content}
            </div>
        </div>
    )
}
