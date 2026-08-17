import cx from "clsx"

import { Frame } from "../Frame/Frame.js"

/** The boxed controls area that sits above a chart */
export function Controls({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}): React.ReactElement {
    return (
        <Frame className={cx("controls", className)}>
            <div className="controls__content">{children}</div>
        </Frame>
    )
}

export function ControlsRow({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}): React.ReactElement {
    return <div className={cx("controls__row", className)}>{children}</div>
}

/**
 * A control with a small uppercase label above it. The label is visual only —
 * controls carry their own `aria-label`.
 */
export function LabeledControl({
    label,
    children,
    className,
}: {
    label: string
    children: React.ReactNode
    className?: string
}): React.ReactElement {
    return (
        <div className={cx("labeled-control", className)}>
            <span className="labeled-control__label">{label}</span>
            {children}
        </div>
    )
}
