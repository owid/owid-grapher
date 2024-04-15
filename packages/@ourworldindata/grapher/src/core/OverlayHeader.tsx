import React from "react"
import cx from "classnames"
import { CloseButton } from "../closeButton/CloseButton.js"

export function OverlayHeader({
    title,
    onDismiss,
    className,
}: {
    title: string
    onDismiss?: () => void
    className?: string
}): JSX.Element {
    return (
        <div className={cx("overlay-header", className)}>
            <h2 className="grapher_h5-black-caps grapher_light">{title}</h2>
            {onDismiss && <CloseButton onClick={onDismiss} />}
        </div>
    )
}
