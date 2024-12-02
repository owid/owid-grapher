import cx from "classnames"
import * as React from "react"

export default function People({
    className,
    columns,
    children,
}: {
    className?: string
    columns?: "2"
    children: React.ReactNode
}) {
    return (
        <div
            className={cx(
                "people grid-cols-2",
                {
                    "grid-md-cols-1": columns === "2",
                },
                className
            )}
        >
            {children}
        </div>
    )
}
