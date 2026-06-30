import cx from "clsx"

export function Frame({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}): React.ReactElement {
    return <div className={cx("frame", className)}>{children}</div>
}
