import { calculateLightnessScore } from "../color/ColorUtils"

export function ProjectedDataPattern({
    patternId,
    color,
    scale = 1,
    patternSize = 4,
    dotSize = patternSize / 4,
}: {
    patternId: string
    color: string
    scale?: number
    patternSize?: number
    dotSize?: number
}): React.ReactElement {
    // Choose the dot opacity based on the lightness of the color:
    // - If the color is light, make the dots more transparent
    // - If the color is dark, make the dots more opaque
    const lightness = calculateLightnessScore(color) ?? 0
    const opacity = Math.max(1 - lightness, 0.1)

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
