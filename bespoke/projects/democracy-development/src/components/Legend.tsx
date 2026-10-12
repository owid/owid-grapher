import cx from "clsx"

import { continentColor, POINT_MAX_RADIUS } from "../core/constants.js"

interface ContinentLegendProps {
    continents: string[]
    muted: ReadonlySet<string>
    onHover: (continent: string | null) => void
    onToggle: (continent: string) => void
    sizeByPopulation: boolean
    maxPop: number
}

/**
 * Grapher's horizontal categorical legend: hover highlights a continent's dots, click toggles it.
 * When bubbles are sized, the size legend is the last item of the row, pushed to its right end and
 * bottom-aligned with the swatches.
 */
export function Legend({
    continents,
    muted,
    onHover,
    onToggle,
    sizeByPopulation,
    maxPop,
}: ContinentLegendProps): React.ReactElement {
    return (
        <div className="dd-legend" aria-label="Continents">
            {continents.map((c) => (
                <button
                    key={c}
                    type="button"
                    className={cx("dd-legend__item", {
                        "is-muted": muted.has(c),
                    })}
                    title={`Click to show or hide ${c}`}
                    onMouseEnter={() => onHover(c)}
                    onMouseLeave={() => onHover(null)}
                    onClick={() => onToggle(c)}
                >
                    <span
                        className="dd-legend__swatch"
                        style={{ background: continentColor(c) }}
                    />
                    {c}
                </button>
            ))}
            {sizeByPopulation && maxPop > 0 && <SizeLegend maxPop={maxPop} />}
        </div>
    )
}

/**
 * Nested circles for population, bottom-aligned, largest first (ScatterSizeLegend): the ticks are
 * round numbers that still draw at least 5px apart in radius.
 */
function SizeLegend({ maxPop }: { maxPop: number }): React.ReactElement | null {
    const rOf = (v: number): number =>
        1.5 + Math.sqrt(v / maxPop) * (POINT_MAX_RADIUS - 1.5)
    const candidates = [
        2e9, 1e9, 5e8, 2e8, 1e8, 5e7, 2e7, 1e7, 5e6, 1e6,
    ].filter((v) => v <= maxPop)
    const ticks: number[] = []
    for (const v of candidates) {
        if (!ticks.length || rOf(ticks[ticks.length - 1]) - rOf(v) >= 5)
            ticks.push(v)
        if (ticks.length === 3) break
    }
    if (!ticks.length) return null
    const rMax = rOf(ticks[0])
    const w = rMax * 2 + 72
    const h = rMax * 2 + 4
    return (
        <div className="dd-size-legend">
            <span className="dd-size-legend__title">
                Bubble size: population
            </span>
            <svg
                width={w}
                height={h}
                viewBox={`0 0 ${w} ${h}`}
                aria-hidden="true"
            >
                {ticks.map((v) => {
                    const r = rOf(v)
                    const cy = h - 2 - r
                    return (
                        <g key={v}>
                            <circle
                                cx={rMax + 1}
                                cy={cy.toFixed(1)}
                                r={r.toFixed(1)}
                                fill="none"
                                stroke="#bbb"
                                strokeWidth={1}
                            />
                            <line
                                x1={rMax + 1}
                                x2={rMax * 2 + 8}
                                y1={(cy - r).toFixed(1)}
                                y2={(cy - r).toFixed(1)}
                                stroke="#ddd"
                                strokeWidth={1}
                            />
                            <text
                                x={rMax * 2 + 10}
                                y={(cy - r + 3.5).toFixed(1)}
                            >
                                {v >= 1e9
                                    ? v / 1e9 + " billion"
                                    : v / 1e6 + " million"}
                            </text>
                        </g>
                    )
                })}
            </svg>
        </div>
    )
}
