import { useId } from "react"

import { DENSITY_GRID } from "../core/density.js"
import type { Scene, SceneMark, SceneSeries } from "./scene.js"
import { REGION_COLORS } from "../core/constants.js"
import type { Region } from "../core/types.js"
import type { PooledDistribution } from "./pooledDistribution.js"
import {
    AXIS_MAX,
    AXIS_MIN,
    DAYS_PER_MONTH,
    formatPeople,
    formatPerDay,
    formatPerMonth,
    REGION_STACK,
} from "./walkthroughData.js"

const MARGIN = { left: 20, right: 20, top: 10, bottom: 34 }
const MONTH_TICKS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
const DAY_TICKS = [0.5, 1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 500]
const DARK = "#2d2d2d"
/**
 * The curves use only this share of the plot's height, so that on a tall
 * screen the mountains don't tower over the axis
 */
const CURVE_HEIGHT_SHARE = 0.7

/** Shorter names for the legend */
const SHORT_REGION_NAMES: Partial<Record<Region, string>> = {
    "Middle East, North Africa, Afghanistan and Pakistan":
        "Middle East, North Africa, Afghanistan & Pakistan",
    "Latin America and Caribbean": "Latin America & Caribbean",
    "Europe and Central Asia": "Europe & Central Asia",
    "East Asia and Pacific": "East Asia & Pacific",
}

/** Draws one frame of the walkthrough. Stateless: everything comes from `scene`. */
export function WalkthroughPlot({
    scene,
    stats,
    year,
    width,
    height,
}: {
    scene: Scene
    stats: Record<string, PooledDistribution>
    /** The year the data is for, which survey figures are nowcast to */
    year: number
    width: number
    height: number
}): React.ReactElement | null {
    const idPrefix = useId().replace(/:/g, "")
    if (width <= 0 || height <= 0) return null

    const plotWidth = width - MARGIN.left - MARGIN.right
    const plotBottom = height - MARGIN.bottom
    const plotHeight = plotBottom - MARGIN.top
    const x = (log2Income: number): number =>
        MARGIN.left +
        ((log2Income - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * plotWidth
    const y = (value: number): number =>
        plotBottom - (value / scene.yMax) * plotHeight * CURVE_HEIGHT_SHARE

    const grid = DENSITY_GRID.log2Incomes
    const indexAt = (l2: number): number =>
        Math.round((l2 - grid[0]) / DENSITY_GRID.step)
    const first = Math.max(indexAt(AXIS_MIN) - 1, 0)
    const last = Math.min(indexAt(AXIS_MAX) + 1, grid.length - 1)

    // Where each stacked series sits, and the stack's running total
    const bases = new Map<string, number[]>()
    const total = new Array<number>(grid.length).fill(0)
    for (const key of REGION_STACK) {
        const s = scene.series[key]
        if (!s?.stacked) continue
        bases.set(
            key,
            total.map((v) => v * scene.stack)
        )
        for (let i = 0; i < grid.length; i++)
            total[i] += (s.density[i] ?? 0) * s.alpha
    }

    const ordered = Object.entries(scene.series).sort(
        ([keyA, a], [keyB, b]) =>
            a.z - b.z ||
            REGION_STACK.indexOf(keyA as Region) -
                REGION_STACK.indexOf(keyB as Region)
    )

    const peakOf = (key: string): { x: number; y: number } | undefined => {
        const s = scene.series[key]
        if (!s) return undefined
        let best = first
        for (let i = first; i <= last; i++)
            if (s.density[i] > s.density[best]) best = i
        const base = bases.get(key)?.[best] ?? 0
        return { x: x(grid[best]), y: y(s.density[best] + base) }
    }

    // Survey boxes that would overlap are lifted above each other
    const placed: { x: number; y: number; w: number; h: number }[] = []
    const place = (bx: number, by: number, w: number, h: number): number => {
        let top = by
        for (const p of placed)
            if (
                bx < p.x + p.w &&
                bx + w > p.x &&
                top < p.y + p.h &&
                top + h > p.y
            )
                top = p.y - h - 4
        placed.push({ x: bx, y: top, w, h })
        return top
    }

    const renderSeries = (key: string, s: SceneSeries): React.ReactNode => {
        if (s.alpha <= 0.002 || s.reveal <= 0) return null
        const base = bases.get(key)
        const end = Math.max(
            first + 1,
            Math.round(first + (last - first) * Math.min(s.reveal, 1))
        )
        let top = ""
        let bottom = ""
        for (let i = first; i <= end; i++) {
            const y0 = base?.[i] ?? 0
            top += `${i === first ? "M" : "L"}${x(grid[i]).toFixed(1)},${y(y0 + s.density[i]).toFixed(1)}`
        }
        for (let i = end; i >= first; i--)
            bottom += `L${x(grid[i]).toFixed(1)},${y(base?.[i] ?? 0).toFixed(1)}`
        const area = `${top}${bottom}Z`
        // Stacked regions are separated by white lines, fading in as they stack
        const whiteness = s.stacked ? scene.stack : 0
        const outlinePath = (color: string, opacity: number): React.ReactNode =>
            opacity > 0.001 && (
                <path
                    d={top}
                    fill="none"
                    stroke={color}
                    strokeOpacity={opacity}
                    strokeWidth={s.strokeWidth}
                    strokeLinejoin="round"
                />
            )
        const draw = (opacity: number): React.ReactNode => (
            <>
                {s.fill > 0 && (
                    <path
                        d={area}
                        fill={s.color}
                        fillOpacity={s.fill * opacity}
                    />
                )}
                {s.stroke > 0 && (
                    <>
                        {outlinePath(
                            s.color,
                            s.stroke * opacity * (1 - whiteness)
                        )}
                        {outlinePath("#fff", s.stroke * opacity * whiteness)}
                    </>
                )}
            </>
        )
        if (s.focusMix <= 0.001)
            return (
                <g key={key} opacity={s.alpha}>
                    {draw(1)}
                </g>
            )
        // Outside the focus the curve is faded; inside it's drawn at full strength
        const clipId = `${idPrefix}-focus-${key.replace(/[^a-z]/gi, "")}`
        return (
            <g key={key} opacity={s.alpha}>
                <clipPath id={clipId}>
                    <rect
                        x={x(s.focusLo)}
                        y={0}
                        width={Math.max(x(s.focusHi) - x(s.focusLo), 0)}
                        height={height}
                    />
                </clipPath>
                {draw(1 - 0.78 * s.focusMix)}
                <g clipPath={`url(#${clipId})`}>{draw(1)}</g>
            </g>
        )
    }

    const renderMark = (key: string, m: SceneMark): React.ReactNode => {
        if (m.alpha <= 0.01) return null
        const opacity = m.alpha
        switch (m.kind) {
            case "curveLabel": {
                const p = peakOf(m.series)
                if (!p) return null
                return (
                    <text
                        key={key}
                        x={p.x}
                        y={p.y - 10}
                        textAnchor="middle"
                        className="walkthrough-plot__label"
                        fill={m.color}
                        opacity={opacity}
                    >
                        {m.text}
                    </text>
                )
            }
            case "corner":
                return (
                    <text
                        key={key}
                        x={width - MARGIN.right}
                        y={MARGIN.top + 14}
                        textAnchor="end"
                        className="walkthrough-plot__corner"
                        opacity={opacity}
                    >
                        {m.text}
                    </text>
                )
            case "survey": {
                const p = peakOf(m.series)
                if (!p) return null
                const w = 150
                const h = 38 + 14 * m.nowcast
                const bx = Math.min(
                    Math.max(p.x - w / 2, MARGIN.left),
                    width - MARGIN.right - w
                )
                const by = place(bx, p.y - h - 12, w, h)
                return (
                    <g key={key} opacity={opacity}>
                        <line
                            x1={p.x}
                            x2={p.x}
                            y1={by + h}
                            y2={p.y - 3}
                            stroke="#a1a1a1"
                        />
                        <rect
                            x={bx}
                            y={by}
                            width={w}
                            height={h}
                            rx={3}
                            fill="#fff"
                            stroke="#d0d0d0"
                        />
                        <text
                            x={bx + 8}
                            y={by + 15}
                            className="walkthrough-plot__tag-title"
                            fill={m.color}
                        >
                            {m.title}
                        </text>
                        <text
                            x={bx + 8}
                            y={by + 30}
                            className="walkthrough-plot__tag-text"
                        >
                            {m.method} survey, {m.year}
                        </text>
                        {m.nowcast > 0.01 && (
                            <text
                                x={bx + 8}
                                y={by + 45}
                                className="walkthrough-plot__tag-text walkthrough-plot__nowcast"
                                opacity={m.nowcast}
                            >
                                → nowcast to {year}
                            </text>
                        )}
                    </g>
                )
            }
            case "readout": {
                const lx = x(m.x)
                const population = stats[m.stats]
                if (!population) return null
                const income = 2 ** m.x
                const share = population.below(income) / population.population
                const incomeText =
                    m.unit === "month"
                        ? `${formatPerMonth(income)} a month`
                        : `${formatPerDay(income)} a day`
                const onRight = lx > width * 0.6
                const tx = onRight ? lx - 10 : lx + 10
                const anchor = onRight ? "end" : "start"
                const offset = m.title ? 20 : 0
                // As the line sets off from the left edge, "0%" says nothing
                const showShare = share >= 0.005
                return (
                    <g key={key} opacity={opacity}>
                        <line
                            x1={lx}
                            x2={lx}
                            y1={MARGIN.top + 6}
                            y2={plotBottom}
                            stroke={DARK}
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                        />
                        <circle
                            cx={lx}
                            cy={MARGIN.top + 6}
                            r={4.5}
                            fill={DARK}
                        />
                        {m.title && (
                            <text
                                x={tx}
                                y={MARGIN.top + 10}
                                textAnchor={anchor}
                                className="walkthrough-plot__readout-title"
                            >
                                {m.title}
                            </text>
                        )}
                        <text
                            x={tx}
                            y={MARGIN.top + 10 + offset}
                            textAnchor={anchor}
                            className="walkthrough-plot__readout-income"
                        >
                            {incomeText}
                        </text>
                        {showShare && (
                            <>
                                <text
                                    x={tx}
                                    y={MARGIN.top + 34 + offset}
                                    textAnchor={anchor}
                                    className="walkthrough-plot__readout-share"
                                    fill={m.color}
                                >
                                    {Math.round(share * 100)}%{" "}
                                    <tspan className="walkthrough-plot__readout-caption">
                                        {m.caption}
                                    </tspan>
                                </text>
                                <text
                                    x={tx}
                                    y={MARGIN.top + 52 + offset}
                                    textAnchor={anchor}
                                    className="walkthrough-plot__readout-caption"
                                >
                                    {formatPeople(
                                        share * population.population
                                    )}{" "}
                                    people
                                </text>
                            </>
                        )}
                    </g>
                )
            }
            case "hop": {
                const x1 = x(m.from)
                const x2 = x(m.to)
                const hy = MARGIN.top + 56
                const lift = 40
                const mid = (x1 + x2) / 2
                return (
                    <g key={key} opacity={opacity}>
                        <path
                            d={`M${x1},${hy + lift} Q${mid},${hy - lift} ${x2},${hy + lift}`}
                            fill="none"
                            stroke={DARK}
                            strokeWidth={2}
                            pathLength={1}
                            strokeDasharray="1"
                            strokeDashoffset={1 - m.draw}
                            markerEnd={
                                m.draw > 0.97
                                    ? `url(#${idPrefix}-arrowhead)`
                                    : undefined
                            }
                        />
                        <text
                            x={mid}
                            y={hy - 10}
                            textAnchor="middle"
                            className="walkthrough-plot__hop"
                        >
                            {m.text}
                        </text>
                        <text
                            x={mid}
                            y={hy - 34}
                            textAnchor="middle"
                            className="walkthrough-plot__readout-caption"
                        >
                            {m.sub}
                        </text>
                        {[x1, x2].map((lx) => (
                            <line
                                key={lx}
                                x1={lx}
                                x2={lx}
                                y1={hy + lift + 4}
                                y2={plotBottom}
                                stroke={DARK}
                                strokeDasharray="2 3"
                            />
                        ))}
                    </g>
                )
            }
            case "tag": {
                const lx = x(m.x)
                const ty = MARGIN.top + 30
                const anchor = m.side === "right" ? "start" : "end"
                const tx = m.side === "right" ? lx + 8 : lx - 8
                return (
                    <g key={key} opacity={opacity}>
                        <line
                            x1={lx}
                            x2={lx}
                            y1={ty - 14}
                            y2={plotBottom}
                            stroke={m.color}
                            strokeWidth={1.5}
                        />
                        <text
                            x={tx}
                            y={ty}
                            textAnchor={anchor}
                            className="walkthrough-plot__tag-title"
                            fill={m.color}
                        >
                            {m.lines[0]}
                        </text>
                        <text
                            x={tx}
                            y={ty + 18}
                            textAnchor={anchor}
                            className="walkthrough-plot__tag-text"
                        >
                            {m.lines[1]}
                        </text>
                    </g>
                )
            }
            case "band": {
                const x1 = x(m.lo)
                const x2 = x(m.hi)
                return (
                    <g key={key} opacity={opacity}>
                        <rect
                            x={x1}
                            y={MARGIN.top}
                            width={x2 - x1}
                            height={plotBottom - MARGIN.top}
                            fill="#1d3d63"
                            fillOpacity={0.05}
                        />
                        {[x1, x2].map((lx) => (
                            <line
                                key={lx}
                                x1={lx}
                                x2={lx}
                                y1={MARGIN.top}
                                y2={plotBottom}
                                stroke={DARK}
                                strokeDasharray="3 3"
                            />
                        ))}
                        <text
                            x={(x1 + x2) / 2}
                            y={MARGIN.top + 18}
                            textAnchor="middle"
                            className="walkthrough-plot__readout-income"
                        >
                            {m.lines[0]}
                        </text>
                        <text
                            x={(x1 + x2) / 2}
                            y={MARGIN.top + 36}
                            textAnchor="middle"
                            className="walkthrough-plot__readout-caption"
                        >
                            {m.lines[1]}
                        </text>
                    </g>
                )
            }
            case "peakLabel": {
                let best = first
                for (let i = first; i <= last; i++)
                    if (total[i] > total[best]) best = i
                const px = x(grid[best])
                const py = y(total[best] * scene.stack)
                return (
                    <g key={key} opacity={opacity}>
                        <line
                            x1={px - 6}
                            y1={py - 4}
                            x2={px - 60}
                            y2={py - 26}
                            stroke={DARK}
                        />
                        <text
                            x={px - 66}
                            y={py - 30}
                            textAnchor="end"
                            className="walkthrough-plot__tag-title"
                            fill={DARK}
                        >
                            {m.text}
                        </text>
                        <text
                            x={px - 66}
                            y={py - 13}
                            textAnchor="end"
                            className="walkthrough-plot__tag-text"
                        >
                            {m.sub}
                        </text>
                    </g>
                )
            }
        }
    }

    const tickSet = (
        ticks: number[],
        toPerDay: (value: number) => number,
        label: (value: number) => string,
        opacity: number
    ): React.ReactNode =>
        opacity > 0.01 &&
        ticks.map((value) => {
            const tx = x(Math.log2(toPerDay(value)))
            return (
                <g key={`${value}-${label(value)}`} opacity={opacity}>
                    <line
                        x1={tx}
                        x2={tx}
                        y1={MARGIN.top}
                        y2={plotBottom}
                        stroke="#e7e7e7"
                    />
                    <text
                        x={tx}
                        y={plotBottom + 20}
                        textAnchor="middle"
                        className="walkthrough-plot__tick"
                    >
                        {label(value)}
                    </text>
                </g>
            )
        })

    // The outline over the stacked total
    let outline = ""
    if (scene.outline.alpha > 0.01)
        for (let i = first; i <= last; i++)
            outline += `${i === first ? "M" : "L"}${x(grid[i]).toFixed(1)},${y(total[i] * scene.stack).toFixed(1)}`

    // Ticks that would crowd each other on a narrow plot are skipped
    const everyOther = plotWidth < 480
    const thin = (ticks: number[]): number[] =>
        everyOther ? ticks.filter((_, i) => i % 2 === 0) : ticks

    return (
        <div className="walkthrough-plot">
            <svg
                className="walkthrough-plot__svg"
                width={width}
                height={height}
                aria-hidden="true"
            >
                <defs>
                    <marker
                        id={`${idPrefix}-arrowhead`}
                        viewBox="0 0 10 10"
                        refX={8}
                        refY={5}
                        markerWidth={8}
                        markerHeight={8}
                        orient="auto-start-reverse"
                    >
                        <path
                            d="M1 1L9 5L1 9"
                            fill="none"
                            stroke={DARK}
                            strokeWidth={1.6}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </marker>
                </defs>
                {tickSet(
                    thin(MONTH_TICKS),
                    (v) => v / DAYS_PER_MONTH,
                    (v) => (v >= 1000 ? `$${v / 1000}k` : `$${v}`),
                    1 - scene.unit
                )}
                {tickSet(
                    thin(DAY_TICKS),
                    (v) => v,
                    (v) => `$${v}`,
                    scene.unit
                )}
                <line
                    x1={MARGIN.left}
                    x2={width - MARGIN.right}
                    y1={plotBottom}
                    y2={plotBottom}
                    stroke="#a1a1a1"
                />
                <text
                    x={width - MARGIN.right}
                    y={plotBottom + 32}
                    textAnchor="end"
                    className="walkthrough-plot__tick walkthrough-plot__tick--unit"
                    opacity={1 - scene.unit}
                >
                    per month
                </text>
                <text
                    x={width - MARGIN.right}
                    y={plotBottom + 32}
                    textAnchor="end"
                    className="walkthrough-plot__tick walkthrough-plot__tick--unit"
                    opacity={scene.unit}
                >
                    per day
                </text>
                {ordered.map(([key, s]) => renderSeries(key, s))}
                {outline && (
                    <path
                        d={outline}
                        fill="none"
                        stroke={DARK}
                        strokeWidth={2.5}
                        strokeLinejoin="round"
                        pathLength={1}
                        strokeDasharray="1"
                        strokeDashoffset={1 - scene.outline.draw}
                        opacity={scene.outline.alpha}
                    />
                )}
                {Object.entries(scene.marks).map(([key, m]) =>
                    renderMark(key, m)
                )}
            </svg>
            {scene.legendAlpha > 0.01 && (
                <ul
                    className="walkthrough-plot__legend"
                    style={{ opacity: scene.legendAlpha }}
                    aria-hidden="true"
                >
                    {scene.legend.map((key) => (
                        <li key={key}>
                            <span
                                className="walkthrough-plot__swatch"
                                style={{
                                    background:
                                        REGION_COLORS[key as Region] ?? "#777",
                                }}
                            />
                            {SHORT_REGION_NAMES[key as Region] ?? key}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
