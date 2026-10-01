import cx from "clsx"

export interface ChartErrorProps {
    className?: string
}

export function ChartError({ className }: ChartErrorProps): React.ReactElement {
    return (
        <div className={cx("chart-error", className)}>
            This chart didn't load.
            <div className="chart-error__hint">Try reloading the page.</div>
        </div>
    )
}
