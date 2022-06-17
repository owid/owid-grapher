import { faAngleRight } from "@fortawesome/free-solid-svg-icons/faAngleRight"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import React from "react"

export enum GalleryArrowDirection {
    prev = "prev",
    next = "next",
}

export const GalleryArrow = ({
    disabled,
    onClick,
    direction,
    label,
}: {
    disabled: boolean
    onClick: VoidFunction
    direction: GalleryArrowDirection
    label: string
}) => {
    const flip =
        direction === GalleryArrowDirection.prev ? "horizontal" : undefined
    const classes = ["gallery-arrow", direction]

    return (
        <button
            disabled={disabled}
            onClick={onClick}
            className={classes.join(" ")}
        >
            <div className="label">{label}</div>
            <FontAwesomeIcon icon={faAngleRight} flip={flip} />
        </button>
    )
}
