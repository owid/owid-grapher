import { KeyChartLevel } from "@ourworldindata/utils"

export const TagBucketSortingIcon = ({ level }: { level?: number }) => {
    const width = 13

    return level !== undefined ? (
        <svg
            width={width}
            height="13"
            viewBox={`0 0 ${width} 13`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            {Array.from({ length: 3 }, (_, idx) => (
                <rect
                    key={idx}
                    y={(KeyChartLevel.Top - (idx + 1)) * 5} // idx: 0 1 2 -> y: 10 5 0
                    width={width}
                    height="3"
                    fill={idx + 1 === level ? "#000000" : "#c1c1c1"}
                />
            ))}
        </svg>
    ) : null
}
