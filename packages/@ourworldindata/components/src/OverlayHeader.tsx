import * as React from "react"
import cx from "classnames"
import { CloseButton } from "./closeButton/CloseButton.js"

export function OverlayHeader({
    title,
    onTitleClick,
    onDismiss,
    className,
}: {
    title: string
    onTitleClick?: () => void
    onDismiss?: () => void
    className?: string
}): React.ReactElement {
    return (
        <div className={cx("overlay-header", className)}>
            <h2
                className={cx("title", {
                    clickable: !!onTitleClick,
                })}
                onClick={onTitleClick}
            >
                {title}
            </h2>
            {onDismiss && <CloseButton onClick={onDismiss} />}
        </div>
    )
}
