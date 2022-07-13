import { faArrowLeftLong } from "@fortawesome/free-solid-svg-icons/faArrowLeftLong"
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
}: {
    disabled: boolean
    onClick: VoidFunction
    direction: GalleryArrowDirection
}) => {
    const flip =
        direction === GalleryArrowDirection.next ? "horizontal" : undefined
    const classes = ["gallery-arrow", direction]

    return (
        <button
            disabled={disabled}
            onClick={onClick}
            className={classes.join(" ")}
        >
            <FontAwesomeIcon icon={faArrowLeftLong} flip={flip} />
        </button>
    )
}
