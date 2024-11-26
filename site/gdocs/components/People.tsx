import cx from "classnames"
import * as React from "react"

export default function People({
    className,
    children,
}: {
    className?: string
    children: React.ReactNode
}) {
    return <div className={cx("people", className)}>{children}</div>
}
