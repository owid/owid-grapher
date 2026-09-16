import cx from "clsx"

export interface ChartErrorProps {
    message?: string
    className?: string
}

export function ChartError({
    message = "This chart couldn't be loaded.",
    className,
}: ChartErrorProps): React.ReactElement {
    return (
        <div className={cx("chart-error", className)}>
            {message}
            <div className="chart-error__hint">Try reloading the page.</div>
        </div>
    )
}
