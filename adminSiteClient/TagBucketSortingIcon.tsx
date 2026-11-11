import { KeyChartLevel } from "@ourworldindata/utils"

// Three stacked squares, the filled one marking where in the topic page's all
// charts block the chart shows: top, middle or bottom
export const TagBucketSortingIcon = ({ level }: { level?: number }) => {
    const size = 4
    const gap = 1.5
    const height = 3 * size + 2 * gap

    return level !== undefined ? (
        <svg
            width={size}
            height={height}
            viewBox={`0 0 ${size} ${height}`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            {Array.from({ length: 3 }, (_, idx) => (
                <rect
                    key={idx}
                    // idx: 0 1 2 -> bottom, middle, top square
                    y={(KeyChartLevel.Top - (idx + 1)) * (size + gap)}
                    width={size}
                    height={size}
                    rx={1}
                    fill={idx + 1 === level ? "#000000" : "#c1c1c1"}
                />
            ))}
        </svg>
    ) : null
}
