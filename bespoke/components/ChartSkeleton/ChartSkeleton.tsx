import cx from "clsx"

import { useDelayedLoading } from "../../hooks/useDelayedLoading.js"
import { Spinner } from "../Spinner/Spinner.js"

export interface ChartSkeletonProps {
    className?: string
}

export function ChartSkeleton({
    className,
}: ChartSkeletonProps): React.ReactElement {
    const showSpinner = useDelayedLoading(true)

    return (
        <div className={cx("chart-skeleton", className)}>
            {showSpinner && <Spinner />}
        </div>
    )
}
