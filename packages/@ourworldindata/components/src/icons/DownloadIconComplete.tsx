// Three stacked cards, back to front. By default they use the same blue
// palette as the sibling download icons; pass `color` (e.g. "currentColor")
// to render a monochrome variant where depth comes from opacity instead.
export function DownloadIconComplete({ color }: { color?: string }) {
    const fills: [string, number | undefined][] = color
        ? [
              [color, 0.35],
              [color, 0.65],
              [color, 1],
          ]
        : [
              ["#a4b6ca", undefined],
              ["#577291", undefined],
              ["#355174", undefined],
          ]
    return (
        <svg
            width="34"
            height="24"
            viewBox="0 0 34 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <rect
                x="10"
                y="1"
                width="20"
                height="14"
                rx="3"
                fill={fills[0][0]}
                fillOpacity={fills[0][1]}
            />
            <rect
                x="5"
                y="5"
                width="20"
                height="14"
                rx="3"
                fill={fills[1][0]}
                fillOpacity={fills[1][1]}
            />
            <rect
                x="0"
                y="9"
                width="20"
                height="14"
                rx="3"
                fill={fills[2][0]}
                fillOpacity={fills[2][1]}
            />
        </svg>
    )
}
