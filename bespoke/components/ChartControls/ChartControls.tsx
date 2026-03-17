import cx from "classnames"
import { Frame } from "../Frame/Frame.js"

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
        <Frame className={cx("chart-controls", className)}>
            <div className="chart-controls__title">{title}</div>
            {children}
        </Frame>
    )
}
