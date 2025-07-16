import * as React from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faXmark } from "@fortawesome/free-solid-svg-icons"

// keep in sync with $size in CloseButton.scss
export const CLOSE_BUTTON_WIDTH = 32
export const CLOSE_BUTTON_HEIGHT = 32

export function CloseButton({
    onClick,
    className,
}: {
    onClick: React.MouseEventHandler<HTMLButtonElement>
    className?: string
}) {
    return (
        <button
            type="button"
            className={cx("close-button", className)}
            onClick={onClick}
            aria-label="Close"
        >
            <FontAwesomeIcon icon={faXmark} />
        </button>
    )
}
