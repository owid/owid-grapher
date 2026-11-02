import cx from "clsx"
import { GrapherTrendArrowDirection } from "@ourworldindata/types"

const ARROW_PATHS = {
    up: "M14 0H5a1 1 0 0 0 0 2h6.586L.293 13.293l1.414 1.414L13 3.414V10a1 1 0 0 0 2 0V1a1 1 0 0 0-1-1",
    down: "M14 4a1 1 0 0 0-1 1v6.586L1.56.146.147 1.56 11.587 13H5a1 1 0 0 0 0 2h9a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1",
    right: "M19.592 6.824 13.228.46a.999.999 0 1 0-1.414 1.414l4.657 4.657H.5v2h15.971l-4.657 4.657a.999.999 0 1 0 1.414 1.414l6.364-6.364a1 1 0 0 0 0-1.414",
} as const

// Default semantic coloring by direction.
const SEMANTIC_COLORS: Record<GrapherTrendArrowDirection, string> = {
    up: "#2c8465", // Green
    down: "#cc3b55", // Red
    right: "#787878", // Grey
}

export function GrapherTrendArrow({
    direction,
    color,
    className,
}: {
    direction: GrapherTrendArrowDirection
    color?: string
    className?: string
}): React.ReactElement {
    return (
        <svg
            className={cx("GrapherTrendArrow", direction, className)}
            style={{ fill: color ?? SEMANTIC_COLORS[direction] }}
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${direction === "right" ? 20 : 15} 15`}
        >
            <path d={ARROW_PATHS[direction]} />
        </svg>
    )
}
