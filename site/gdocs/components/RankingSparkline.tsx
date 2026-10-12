import { LinkedRanking } from "@ourworldindata/types"
import { getComparableWorldSeries } from "./rankingUtils.js"

type SparklineSeries = [number, number][]
type Sparkline = NonNullable<LinkedRanking["sparkline"]>

const VIEWBOX_WIDTH = 220
const VIEWBOX_HEIGHT = 36
const PADDING = 2

interface Scales {
    x: (time: number) => number
    y: (value: number) => number
}

/** Scales to [0, 1] each (y = 0 at the top) */
function makeScales(
    [minTime, maxTime]: [number, number],
    [minValue, maxValue]: [number, number]
): Scales {
    const innerHeight = VIEWBOX_HEIGHT - 2 * PADDING
    return {
        x: (time) =>
            maxTime === minTime ? 0.5 : (time - minTime) / (maxTime - minTime),
        y: (value) =>
            maxValue === minValue
                ? 0.5
                : (PADDING +
                      (1 - (value - minValue) / (maxValue - minValue)) *
                          innerHeight) /
                  VIEWBOX_HEIGHT,
    }
}

function toPoints(series: SparklineSeries, { x, y }: Scales): string {
    return series
        .map(
            ([time, value]) =>
                `${(x(time) * VIEWBOX_WIDTH).toFixed(1)},${(y(value) * VIEWBOX_HEIGHT).toFixed(1)}`
        )
        .join(" ")
}

const toPercent = (fraction: number): string =>
    `${(fraction * 100).toFixed(2)}%`

/**
 * Entity-vs-World line on a shared y-scale (World is left out if its values
 * are on a different scale, see checkIsWorldComparable), with dots and year
 * labels at the start and end of the entity's line. Decorative: the card
 * it's part of states the values in text.
 */
export function RankingSparkline({
    sparkline,
    formatTime = String,
}: {
    sparkline: Sparkline
    formatTime?: (time: number) => string
}) {
    const { entity } = sparkline
    if (entity.length < 2) return null
    // Clipped to the entity's time range
    const world = getComparableWorldSeries(sparkline) ?? []

    const first = entity[0]
    const last = entity[entity.length - 1]
    const values = [...entity, ...world].map(([, value]) => value)
    const scales = makeScales(
        [first[0], last[0]],
        [Math.min(...values), Math.max(...values)]
    )

    return (
        <div className="ranking-sparkline" aria-hidden="true">
            <div className="ranking-sparkline__plot">
                <svg
                    className="ranking-sparkline__svg"
                    viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                    preserveAspectRatio="none"
                    focusable="false"
                >
                    {world.length > 1 && (
                        <polyline
                            className="ranking-sparkline__world"
                            points={toPoints(world, scales)}
                            vectorEffect="non-scaling-stroke"
                        />
                    )}
                    <polyline
                        className="ranking-sparkline__entity"
                        points={toPoints(entity, scales)}
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>
                {/* HTML rather than SVG circles, which the non-uniformly
                    scaled viewBox would distort */}
                {[first, last].map(([time, value]) => (
                    <span
                        key={time}
                        className="ranking-sparkline__dot"
                        style={{
                            left: toPercent(scales.x(time)),
                            top: toPercent(scales.y(value)),
                        }}
                    />
                ))}
            </div>
            <div className="ranking-sparkline__years">
                <span>{formatTime(first[0])}</span>
                <span>{formatTime(last[0])}</span>
            </div>
        </div>
    )
}
