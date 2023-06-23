import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import React, { useState } from "react"
import cx from "classnames"

export const ExpandableToggle = ({
    label,
    content,
    isExpandedDefault = false,
    isStacked = false,
    hasTeaser = false,
}: {
    label: string
    content?: React.ReactNode
    isExpandedDefault?: boolean
    isStacked?: boolean
    hasTeaser?: boolean
}) => {
    const [isOpen, setOpen] = useState(isExpandedDefault)

    const toggle = () => {
        setOpen(!isOpen)
    }

    return (
        <div
            className={cx("ExpandableToggle", {
                "ExpandableToggle--stacked": isStacked,
                "ExpandableToggle--teaser": hasTeaser,
            })}
        >
            <button
                className={cx("ExpandableToggle__button", {
                    "ExpandableToggle__button--teaser": hasTeaser,
                })}
                onClick={toggle}
            >
                <h4 className="ExpandableToggle__title">{label}</h4>
                <FontAwesomeIcon
                    className="ExpandableToggle__icon"
                    icon={!isOpen ? faPlus : faMinus}
                />
            </button>
            <div
                className={cx("ExpandableToggle__content", {
                    "ExpandableToggle__content--open": isOpen,
                    "ExpandableToggle__content--teaser": hasTeaser,
                })}
            >
                {content}
            </div>
        </div>
    )
}
