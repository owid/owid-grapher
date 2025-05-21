export function ProjectedDataPattern({
    patternId,
    color,
    opacity = 0.5,
    scale = 1,
    size = 7,
    strokeWidth = 10,
}: {
    patternId: string
    color: string
    opacity?: number
    scale?: number
    size?: number
    strokeWidth?: number
}): React.ReactElement {
    return (
        <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={size}
            height={size}
            patternTransform={`rotate(45) scale(${scale})`}
        >
            {/* semi-transparent background */}
            <rect width={size} height={size} fill={color} opacity={opacity} />

            {/* stripes */}
            <line
                x1="0"
                y1="0"
                x2="0"
                y2={size}
                stroke={color}
                strokeWidth={strokeWidth}
            />
        </pattern>
    )
}
