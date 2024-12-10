import cx from "classnames"
import * as React from "react"

export default function People({
    className,
    columns,
    children,
}: {
    className?: string
    columns?: "2" | "4"
    children: React.ReactNode
}) {
    return (
        <div
            className={cx(
                "people",
                {
                    "people-cols-2 grid-cols-2 grid-md-cols-1": columns === "2",
                    "people-cols-4 grid-cols-4 grid-lg-cols-2 grid-sm-cols-1":
                        columns === "4",
                },
                className
            )}
        >
            {children}
        </div>
    )
}
