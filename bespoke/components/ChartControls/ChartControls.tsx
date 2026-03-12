import cx from "classnames"

export function ChartControls({
    title = "Configure the data",
    children,
    className,
}: {
    title?: string
    children?: React.ReactNode
    className?: string
}): React.ReactElement {
    return (
        <div className={cx("chart-controls", className)}>
            <div className="chart-controls__title">{title}</div>
            {children}
        </div>
    )
}
