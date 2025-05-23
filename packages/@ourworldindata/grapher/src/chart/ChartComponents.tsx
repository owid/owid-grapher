import { calculateLightnessScore } from "../color/ColorUtils"

export function StripedProjectedDataPattern({
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

export function DottedProjectedDataPattern({
    patternId,
    color,
    scale = 1,
    patternSize = 4,
    dotSize = patternSize / 4,
    dotOpacity,
}: {
    patternId: string
    color: string
    scale?: number
    patternSize?: number
    dotSize?: number
    dotOpacity?: number // inferred from color lightness if not provided
}): React.ReactElement {
    // Choose the dot opacity based on the lightness of the color:
    // - If the color is light, make the dots more transparent
    // - If the color is dark, make the dots more opaque
    const lightness = calculateLightnessScore(color) ?? 0
    const opacity = dotOpacity ?? Math.max(1 - lightness, 0.1)

    return (
        <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={patternSize}
            height={patternSize}
            patternTransform={`rotate(45) scale(${scale})`}
        >
            {/* colored background */}
            <rect width={patternSize} height={patternSize} fill={color} />

            {/* dots */}
            <circle
                cx={patternSize / 2}
                cy={patternSize / 2}
                r={dotSize}
                fill="black"
                fillOpacity={opacity}
            />
        </pattern>
    )
}
