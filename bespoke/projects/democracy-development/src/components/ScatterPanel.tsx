import { useCallback, useMemo, useRef } from "react"
import cx from "clsx"

import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"

import type { Feed } from "../core/feed.js"
import { panelPoints, PointFilters } from "../core/points.js"
import type {
    EntityId,
    IndexKey,
    OutcomeKey,
    PanelPoint,
} from "../core/types.js"
import {
    continentColor,
    FAINT_TICK_COLOR,
    INACTIVE_POINT_COLOR,
    PANEL_MARGIN,
    POINT_MAX_RADIUS,
    POINT_MIN_RADIUS,
    POINT_RADIUS,
    POINT_STROKE,
    POINT_STROKE_HOVER,
    SOLID_TICK_COLOR,
    TICK_COLOR,
    TICK_LABEL_COLOR,
    WEDGE_FILL,
    WEDGE_FILL_OPACITY,
    WEDGE_STROKE_OPACITY,
    X_VARS,
    Y_VARS,
} from "../core/constants.js"
import {
    Domain,
    domainExtent,
    grapherTicks,
    mergeAuthorDomain,
} from "../core/axis.js"
import {
    WEDGE_LABEL_PAD,
    WEDGE_LABEL_SIZES_SMALL,
    WEDGE_LABEL_WEIGHT,
    wrapIntoWedge,
} from "../core/wedge.js"

/** Where the pointer is, for the tooltip; `fixed` pins it to the bottom on touch */
export interface HoverContext {
    panel: OutcomeKey
    clientX: number
    clientY: number
    fixed: boolean
}

export interface AnimationRange {
    start: number
    end: number
}

interface ScatterPanelProps {
    feed: Feed
    xKey: IndexKey
    yKey: OutcomeKey
    year: number
    years: number[]
    /** While playing, the years the axis has to hold still for */
    animation: AnimationRange | null
    filters: PointFilters
    selected: ReadonlySet<EntityId>
    hovered: EntityId | null
    hoverContinent: string | null
    sizeByPopulation: boolean
    maxPop: number
    /** The fit-to-screen scale the frame is drawn at; pointer offsets are divided by it */
    scale: number
    onHover: (eid: EntityId | null, context?: HoverContext) => void
    onToggle: (eid: EntityId) => void
}

/** Bubble radius: a sqrt scale on [0, maxPop], so area is proportional to population */
export function radiusOf(
    point: { pop: number | null },
    sizeByPopulation: boolean,
    maxPop: number
): number {
    if (!sizeByPopulation || point.pop === null) return POINT_RADIUS
    return Math.max(
        POINT_MIN_RADIUS,
        1.5 + Math.sqrt(point.pop / (maxPop || 1)) * (POINT_MAX_RADIUS - 1.5)
    )
}

export function ScatterPanel({
    feed,
    xKey,
    yKey,
    year,
    years,
    animation,
    filters,
    selected,
    hovered,
    hoverContinent,
    sizeByPopulation,
    maxPop,
    scale,
    onHover,
    onToggle,
}: ScatterPanelProps): React.ReactElement {
    const { width, ref } = useContainerWidth()
    const svgRef = useRef<SVGSVGElement>(null)
    const x = X_VARS[xKey]
    const y = Y_VARS[yKey]

    const w = width
    const h = Math.max(180, Math.min(300, Math.round(w * 0.62)))

    const points = useMemo(
        () => panelPoints(feed, xKey, yKey, year, filters),
        [feed, xKey, yKey, year, filters]
    )

    // The y values behind the axis: this year's points, or every year's in the play range while playing.
    const domain: Domain = useMemo(() => {
        let values = points.map((d) => d.y)
        if (animation) {
            values = []
            for (const yr of years)
                if (yr >= animation.start && yr <= animation.end)
                    for (const d of panelPoints(feed, xKey, yKey, yr, filters))
                        values.push(d.y)
        }
        return mergeAuthorDomain(
            domainExtent(values, y.scale),
            y.authorMin,
            y.authorMax,
            y.scale
        )
    }, [points, animation, years, feed, xKey, yKey, filters, y])

    // Ticks first: the widest label sets the left margin, and the scales depend on it.
    const ticks = useMemo(
        () =>
            grapherTicks(
                domain,
                y.scale,
                h - PANEL_MARGIN.top - PANEL_MARGIN.bottom
            ),
        [domain, y.scale, h]
    )
    const left = Math.max(
        28,
        Math.round(
            Math.max(
                0,
                ...ticks
                    .filter((t) => !t.gridLineOnly)
                    .map((t) => y.fmtTick(t.value).length)
            ) * 6.6
        ) + 10
    )
    const right = w - PANEL_MARGIN.right
    const top = PANEL_MARGIN.top
    const bottom = h - PANEL_MARGIN.bottom

    const sx = useCallback(
        (v: number) =>
            left +
            ((v - x.domain[0]) / (x.domain[1] - x.domain[0])) * (right - left),
        [left, right, x.domain]
    )
    const sy = useCallback(
        (v: number) => {
            const [a, b] = domain
            const plotH = bottom - top
            if (y.scale === "log") {
                const la = Math.log10(a)
                const lb = Math.log10(b)
                return (
                    top +
                    plotH -
                    ((Math.log10(Math.max(v, a)) - la) / (lb - la)) * plotH
                )
            }
            return top + plotH - ((v - a) / (b - a)) * plotH
        },
        [domain, top, bottom, y.scale]
    )

    const positioned = useMemo(
        () => points.map((d) => ({ ...d, px: sx(d.x), py: sy(d.y) })),
        [points, sx, sy]
    )
    const byId = useMemo(
        () => new Map(positioned.map((d) => [d.eid, d])),
        [positioned]
    )

    // The empty corner, above the gridlines and below the dots.
    const wedge = useMemo(() => {
        if (w <= 0) return null
        const a = x.wedgeLeg[yKey]
        const W = right - left
        const H = bottom - top
        const pts: [number, number][] = [
            [right - a * W, bottom],
            [right, bottom],
            [right, bottom - a * H],
        ]
        // The full sentence at a legible size; failing that the short label at a legible size; only then smaller type.
        const wrapped =
            wrapIntoWedge(y.wedgeLabel, a * W, a * H) ||
            wrapIntoWedge(y.wedgeLabelShort, a * W, a * H) ||
            wrapIntoWedge(
                y.wedgeLabel,
                a * W,
                a * H,
                WEDGE_LABEL_SIZES_SMALL
            ) ||
            wrapIntoWedge(
                y.wedgeLabelShort,
                a * W,
                a * H,
                WEDGE_LABEL_SIZES_SMALL
            )
        return { points: pts, wrapped }
    }, [w, x, yKey, y, left, right, top, bottom])

    const layerMode =
        hovered !== null || selected.size > 0 || hoverContinent !== null
    const isForeground = (eid: EntityId): boolean => {
        if (hovered === eid) return true
        if (hoverContinent && feed.continentOf[eid] === hoverContinent)
            return true
        return selected.has(eid) && !hoverContinent
    }
    const rOf = (d: PanelPoint): number => radiusOf(d, sizeByPopulation, maxPop)

    // Background dots: larger bubbles behind smaller ones, as grapher draws them.
    const background = useMemo(() => {
        const order = sizeByPopulation
            ? positioned.slice().sort((a, b) => (b.pop || 0) - (a.pop || 0))
            : positioned
        return order
    }, [positioned, sizeByPopulation])

    // Foreground: hovered / selected entities, larger by 1px when hovered, with a label
    // (ScatterPointsWithLabels). The hovered dot is drawn last but its label is placed first, so
    // neighbours yield to it; lower-priority labels hide behind a neighbour, as grapher's do.
    const foreground = layerMode
        ? positioned.filter((d) => isForeground(d.eid))
        : []
    foreground.sort(
        (a, b) => Number(a.eid === hovered) - Number(b.eid === hovered)
    )
    const labels = new Map<
        EntityId,
        { lx: number; ly: number; anchor: "start" | "end" }
    >()
    {
        const placed: { x: number; y: number; w: number; h: number }[] = []
        for (const d of [...foreground].reverse()) {
            if (!(d.eid === hovered || selected.has(d.eid))) continue
            const text = feed.entities[d.eid]
            const est = text.length * 5.6
            const lh = 12
            const rr = rOf(d)
            let lx = d.px + rr + 3
            let anchor: "start" | "end" = "start"
            if (lx + est > w - 2) {
                lx = d.px - rr - 3
                anchor = "end"
            }
            const ly = d.py + 3.5
            const box = {
                x: anchor === "start" ? lx : lx - est,
                y: ly - 10,
                w: est,
                h: lh,
            }
            const collides = placed.some(
                (b) =>
                    !(
                        box.x + box.w < b.x ||
                        b.x + b.w < box.x ||
                        box.y + box.h < b.y ||
                        b.y + b.h < box.y
                    )
            )
            if (collides && d.eid !== hovered) continue
            placed.push(box)
            labels.set(d.eid, { lx, ly, anchor })
        }
    }

    // Selected countries without a dot this year (NoDataSection).
    const missing = [...selected]
        .filter(
            (eid) =>
                !byId.has(eid) &&
                !filters.mutedContinents.has(feed.continentOf[eid])
        )
        .map((eid) => feed.entities[eid])
        .sort()

    // Nearest dot within reach: distance to the bubble's edge, at most 9px (grapher's quadtree hit test).
    const nearest = (clientX: number, clientY: number): EntityId | null => {
        const svg = svgRef.current
        if (!svg) return null
        const rect = svg.getBoundingClientRect()
        const mx = (clientX - rect.left) / scale
        const my = (clientY - rect.top) / scale
        let best: EntityId | null = null
        let bd = Infinity
        for (const d of positioned) {
            const dx = d.px - mx
            const dy = d.py - my
            const dd = Math.sqrt(dx * dx + dy * dy) - rOf(d)
            if (dd < 9 && dd < bd) {
                bd = dd
                best = d.eid
            }
        }
        return best
    }

    return (
        <div ref={ref} className="dd-panel" data-panel={yKey}>
            <h3 className="dd-panel__title">{y.title}</h3>
            <p className="dd-panel__unit">{y.unit}</p>
            {w > 0 && (
                <svg
                    ref={svgRef}
                    className="dd-panel__svg"
                    width={w}
                    height={h}
                    viewBox={`0 0 ${w} ${h}`}
                    role="img"
                    aria-label={`${y.title} against ${x.label}`}
                >
                    <g className="dd-panel__grid">
                        {ticks.map((t) => {
                            const yy = sy(t.value)
                            // The zero line is solid; the baseline already draws it when 0 is the floor.
                            if (Math.abs(yy - bottom) <= 0.5) return null
                            const solid = t.value === 0 || t.faint
                            return (
                                <line
                                    key={`y${t.value}`}
                                    x1={left}
                                    x2={right}
                                    y1={yy}
                                    y2={yy}
                                    stroke={
                                        t.faint
                                            ? FAINT_TICK_COLOR
                                            : t.value === 0
                                              ? SOLID_TICK_COLOR
                                              : TICK_COLOR
                                    }
                                    strokeDasharray={solid ? undefined : "4,4"}
                                    strokeWidth={1}
                                />
                            )
                        })}
                        {x.ticks.map((t) =>
                            t === x.domain[0] ? null : (
                                <line
                                    key={`x${t}`}
                                    x1={sx(t)}
                                    x2={sx(t)}
                                    y1={top}
                                    y2={bottom}
                                    stroke={TICK_COLOR}
                                    strokeDasharray="4,4"
                                    strokeWidth={1}
                                />
                            )
                        )}
                    </g>
                    {wedge && (
                        <g className="dd-panel__wedge">
                            <polygon
                                points={wedge.points
                                    .map((q) =>
                                        q.map((v) => v.toFixed(1)).join(",")
                                    )
                                    .join(" ")}
                                fill={WEDGE_FILL}
                                fillOpacity={WEDGE_FILL_OPACITY}
                                stroke={WEDGE_FILL}
                                strokeOpacity={WEDGE_STROKE_OPACITY}
                                strokeWidth={1}
                                strokeLinejoin="round"
                            />
                            {wedge.wrapped?.lines.map((line, i, lines) => (
                                <text
                                    key={i}
                                    className="dd-panel__wedge-label"
                                    x={right - WEDGE_LABEL_PAD}
                                    // Baseline a fifth of a line above the box's bottom
                                    y={(
                                        bottom -
                                        WEDGE_LABEL_PAD -
                                        (lines.length - 1 - i) *
                                            wedge.wrapped!.lh -
                                        0.2 * wedge.wrapped!.lh
                                    ).toFixed(1)}
                                    textAnchor="end"
                                    fill={WEDGE_FILL}
                                    style={{
                                        fontSize: wedge.wrapped!.px,
                                        fontWeight: WEDGE_LABEL_WEIGHT,
                                    }}
                                >
                                    {line}
                                </text>
                            ))}
                        </g>
                    )}
                    <g className="dd-panel__axes">
                        {ticks
                            .filter((t) => !t.gridLineOnly)
                            .map((t) => (
                                <text
                                    key={t.value}
                                    x={left - 6}
                                    y={sy(t.value)}
                                    dy="0.32em"
                                    textAnchor="end"
                                    fill={TICK_LABEL_COLOR}
                                >
                                    {y.fmtTick(t.value)}
                                </text>
                            ))}
                        {x.ticks.map((t) => {
                            const xx = sx(t)
                            // Hanging tick marks; the outermost labels are anchored inwards.
                            const anchor =
                                t === x.domain[0]
                                    ? "start"
                                    : t === x.domain[1]
                                      ? "end"
                                      : "middle"
                            return (
                                <g key={t}>
                                    <line
                                        x1={xx}
                                        x2={xx}
                                        y1={bottom}
                                        y2={bottom + 5}
                                        stroke={SOLID_TICK_COLOR}
                                        strokeWidth={1}
                                    />
                                    <text
                                        x={xx}
                                        y={bottom + 9}
                                        dy="0.9em"
                                        textAnchor={anchor}
                                        fill={TICK_LABEL_COLOR}
                                    >
                                        {x.fmtTick(t)}
                                    </text>
                                </g>
                            )
                        })}
                        {/* The baseline is the axis line */}
                        <line
                            x1={left}
                            x2={right}
                            y1={bottom}
                            y2={bottom}
                            stroke={SOLID_TICK_COLOR}
                            strokeWidth={1}
                        />
                    </g>
                    <g className="dd-panel__points">
                        {background.map((d) => {
                            const fg = layerMode && isForeground(d.eid)
                            // Drawn in the foreground group instead, so it sits above every background dot
                            if (fg) return null
                            const muted = layerMode && !fg
                            return (
                                <circle
                                    key={d.eid}
                                    cx={d.px.toFixed(1)}
                                    cy={d.py.toFixed(1)}
                                    r={rOf(d).toFixed(2)}
                                    fill={
                                        muted
                                            ? INACTIVE_POINT_COLOR
                                            : continentColor(
                                                  feed.continentOf[d.eid]
                                              )
                                    }
                                    stroke={muted ? "#bbb" : POINT_STROKE}
                                    strokeWidth={0.5}
                                    opacity={0.8}
                                />
                            )
                        })}
                    </g>
                    <g className="dd-panel__foreground">
                        {foreground.map((d) => {
                            const color = continentColor(
                                feed.continentOf[d.eid]
                            )
                            const hov = d.eid === hovered
                            const rr = rOf(d)
                            return (
                                <g key={d.eid}>
                                    {selected.has(d.eid) && (
                                        <circle
                                            cx={d.px}
                                            cy={d.py}
                                            r={rr + 3}
                                            fill="none"
                                            stroke={color}
                                            strokeWidth={1}
                                            opacity={0.6}
                                        />
                                    )}
                                    <circle
                                        cx={d.px}
                                        cy={d.py}
                                        r={hov ? rr + 1 : rr}
                                        fill={color}
                                        stroke={
                                            hov
                                                ? POINT_STROKE_HOVER
                                                : POINT_STROKE
                                        }
                                        strokeWidth={0.5}
                                    />
                                </g>
                            )
                        })}
                    </g>
                    <g className="dd-panel__labels">
                        {foreground.map((d) => {
                            const lab = labels.get(d.eid)
                            if (!lab) return null
                            return (
                                <text
                                    key={d.eid}
                                    className="dd-panel__point-label"
                                    x={lab.lx}
                                    y={lab.ly}
                                    textAnchor={lab.anchor}
                                    fill={continentColor(
                                        feed.continentOf[d.eid]
                                    )}
                                    fontWeight={d.eid === hovered ? 700 : 400}
                                >
                                    {feed.entities[d.eid]}
                                </text>
                            )
                        })}
                    </g>
                    {/* A transparent rect catches the pointer over the whole plot for nearest-dot hovering */}
                    <rect
                        className="dd-panel__hit"
                        x={left}
                        y={0}
                        width={Math.max(0, right - left)}
                        height={bottom + 8}
                        fill="rgba(255,255,255,0)"
                        onMouseMove={(e) => {
                            const eid = nearest(e.clientX, e.clientY)
                            if (eid === null) onHover(null)
                            else
                                onHover(eid, {
                                    panel: yKey,
                                    clientX: e.clientX,
                                    clientY: e.clientY,
                                    fixed: false,
                                })
                        }}
                        onMouseLeave={() => onHover(null)}
                        onClick={(e) => {
                            const eid = nearest(e.clientX, e.clientY)
                            if (eid !== null) onToggle(eid)
                        }}
                        onTouchStart={(e) => {
                            const t = e.touches[0]
                            const eid = nearest(t.clientX, t.clientY)
                            if (eid !== null) {
                                e.preventDefault()
                                onHover(eid, {
                                    panel: yKey,
                                    clientX: t.clientX,
                                    clientY: t.clientY,
                                    fixed: true,
                                })
                            }
                        }}
                    />
                </svg>
            )}
            {w > 0 && points.length === 0 && (
                <div className="dd-panel__no-data">No data for {year}</div>
            )}
            {missing.length > 0 && points.length > 0 && (
                <div className={cx("dd-panel__no-data-section")}>
                    <div className="dd-panel__no-data-heading">No data</div>
                    <ul>
                        {missing.slice(0, 3).map((name) => (
                            <li key={name}>{name}</li>
                        ))}
                    </ul>
                    {missing.length > 3 && (
                        <div>
                            &amp;{" "}
                            {missing.length - 3 === 1
                                ? "one"
                                : missing.length - 3}{" "}
                            more
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
