import * as React from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faXmark } from "@fortawesome/free-solid-svg-icons"

// keep in sync with $size in CloseButton.scss
const CLOSE_BUTTON_SIZE = 32

export const CLOSE_BUTTON_WIDTH = CLOSE_BUTTON_SIZE
export const CLOSE_BUTTON_HEIGHT = CLOSE_BUTTON_SIZE

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
        >
            <FontAwesomeIcon icon={faXmark} />
        </button>
    )
}
