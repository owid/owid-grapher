import { useRef, useState } from "react"

import type { CardRow, SeriesPoint } from "../types.js"
import { formatValue } from "../helpers/format.js"

const WIDTH = 96
const HEIGHT = 30
const PAD = 3

const xOf = (x: number, dom: [number, number]): number =>
    dom[1] === dom[0]
        ? WIDTH / 2
        : PAD + ((x - dom[0]) / (dom[1] - dom[0])) * (WIDTH - 2 * PAD)
const yOf = (y: number, lo: number, hi: number): number =>
    hi === lo
        ? HEIGHT / 2
        : HEIGHT - PAD - ((y - lo) / (hi - lo)) * (HEIGHT - 2 * PAD)

const pathOf = (
    pts: SeriesPoint[],
    dom: [number, number],
    lo: number,
    hi: number
): string =>
    pts
        .map(
            (p, i) =>
                (i ? "L" : "M") +
                xOf(p[0], dom).toFixed(1) +
                " " +
                yOf(p[1], lo, hi).toFixed(1)
        )
        .join(" ")

/** The series point at a given year, or null if the year is outside its covered range */
function pointAt(series: SeriesPoint[], year: number): SeriesPoint | null {
    if (!series.length || year < series[0][0] || year > series.at(-1)![0])
        return null
    let best = series[0]
    for (const p of series)
        if (Math.abs(p[0] - year) < Math.abs(best[0] - year)) best = p
    return best
}

interface HoverState {
    /** cursor x in viewBox units */
    x: number
    year: number
    countryPoint: SeriesPoint | null
    compPoint: SeriesPoint | null
    clientX: number
    clientY: number
}

/**
 * A tiny then→now line chart: the country's series in the row's tone color, the
 * comparison entity as a faint ghost line. X is scaled to the shared full-lifetime
 * domain, so partial-coverage metrics only fill their slice and all rows line up
 * on the same time axis. Hovering shows the year + both values.
 */
export function Sparkline({
    row,
    domain,
    countryName,
    compName,
}: {
    row: CardRow
    domain: [number, number]
    countryName: string
    compName: string
}) {
    const svgRef = useRef<SVGSVGElement>(null)
    const [hover, setHover] = useState<HoverState | null>(null)

    const ys = [...row.country, ...row.comp].map((p) => p[1])
    const lo = Math.min(...ys)
    const hi = Math.max(...ys)
    const color =
        row.tone === "warn"
            ? "var(--ylid-warn)"
            : row.tone === "good"
              ? "var(--ylid-good)"
              : "var(--ylid-neutral)"
    const last = row.country.at(-1)!
    const compLast = row.comp.at(-1)

    const onMouseMove = (e: React.MouseEvent<SVGSVGElement>): void => {
        const svg = svgRef.current
        const ctm = svg?.getScreenCTM()
        if (!svg || !ctm) return
        // map the cursor into viewBox units via the SVG's own transform, so it stays
        // correct under any scaling (e.g. the stretched mobile sparkline)
        const x = Math.max(
            PAD,
            Math.min(WIDTH - PAD, (e.clientX - ctm.e) / ctm.a)
        )
        const year = Math.round(
            domain[0] +
                ((x - PAD) / (WIDTH - 2 * PAD)) * (domain[1] - domain[0])
        )
        setHover({
            x,
            year,
            countryPoint: pointAt(row.country, year),
            compPoint: pointAt(row.comp, year),
            clientX: e.clientX,
            clientY: e.clientY,
        })
    }

    return (
        <>
            <svg
                ref={svgRef}
                className="your-life-in-data__spark"
                width={WIDTH}
                height={HEIGHT}
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                onMouseMove={onMouseMove}
                onMouseLeave={() => setHover(null)}
            >
                {row.comp.length > 0 && (
                    <>
                        <path
                            d={pathOf(row.comp, domain, lo, hi)}
                            fill="none"
                            stroke="var(--ylid-ghost)"
                            strokeWidth={1.4}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                        {compLast && (
                            <circle
                                cx={xOf(compLast[0], domain).toFixed(1)}
                                cy={yOf(compLast[1], lo, hi).toFixed(1)}
                                r={2}
                                fill="none"
                                stroke="var(--ylid-ghost)"
                                strokeWidth={1.2}
                            />
                        )}
                    </>
                )}
                <path
                    d={pathOf(row.country, domain, lo, hi)}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
                <circle
                    cx={xOf(last[0], domain).toFixed(1)}
                    cy={yOf(last[1], lo, hi).toFixed(1)}
                    r={2.6}
                    fill={color}
                />
                {hover && (
                    <>
                        <line
                            x1={hover.x}
                            x2={hover.x}
                            y1={0}
                            y2={HEIGHT}
                            stroke="var(--ylid-ink)"
                            strokeWidth={0.6}
                            opacity={0.3}
                        />
                        {hover.compPoint && (
                            <circle
                                cx={xOf(hover.compPoint[0], domain)}
                                cy={yOf(hover.compPoint[1], lo, hi)}
                                r={2.4}
                                fill="#fff"
                                stroke="var(--ylid-neutral)"
                                strokeWidth={1.3}
                            />
                        )}
                        {hover.countryPoint && (
                            <circle
                                cx={xOf(hover.countryPoint[0], domain)}
                                cy={yOf(hover.countryPoint[1], lo, hi)}
                                r={2.8}
                                fill={color}
                            />
                        )}
                    </>
                )}
                <rect
                    x={0}
                    y={0}
                    width={WIDTH}
                    height={HEIGHT}
                    fill="transparent"
                />
            </svg>
            {hover && (
                <div
                    className="your-life-in-data__sparktip"
                    style={{
                        left: Math.min(
                            hover.clientX + 12,
                            window.innerWidth - 180
                        ),
                        top: hover.clientY + 14,
                    }}
                >
                    <b>{hover.year}</b>
                    <div className="your-life-in-data__sparktip-row">
                        <span className="your-life-in-data__sparktip-key">
                            {countryName}
                        </span>
                        <span className="your-life-in-data__sparktip-value">
                            {hover.countryPoint
                                ? formatValue(
                                      hover.countryPoint[1],
                                      row.meta.format
                                  )
                                : "—"}
                        </span>
                    </div>
                    {row.comp.length > 0 && (
                        <div className="your-life-in-data__sparktip-row">
                            <span className="your-life-in-data__sparktip-key">
                                {compName}
                            </span>
                            <span className="your-life-in-data__sparktip-value">
                                {hover.compPoint
                                    ? formatValue(
                                          hover.compPoint[1],
                                          row.meta.format
                                      )
                                    : "—"}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </>
    )
}
