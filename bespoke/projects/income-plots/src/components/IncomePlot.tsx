import { useEffect, useMemo, useRef } from "react"
import { useAtom, useAtomValue } from "jotai"
import * as Plot from "@observablehq/plot"
import { formatCurrency, usePlot } from "../utils/incomePlotUtils.ts"
import {
    atomCustomPovertyLine,
    atomHoveredEntity,
    atomHoveredX,
    atomKdeDataForYearGroupedByRegion,
    atomPlotColorScale,
    atomShowCustomPovertyLine,
    atomTimeIntervalFactor,
} from "../store.ts"
import * as R from "remeda"

const style = {
    fontFamily:
        'Lato, "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif',
    fontSize: "11.5px",
}

interface IncomePlotProps {
    width?: number
    height?: number
}

export function IncomePlot({ width = 1000, height = 500 }: IncomePlotProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const points = useAtomValue(atomKdeDataForYearGroupedByRegion)
    const [povertyLine, setPovertyLine] = useAtom(atomCustomPovertyLine)
    const [showPovertyLine, setShowPovertyLine] = useAtom(
        atomShowCustomPovertyLine
    )
    const plotColorScale = useAtomValue(atomPlotColorScale)
    const [hoveredEntity, setHoveredEntity] = useAtom(atomHoveredEntity)
    const [hoveredX, setHoveredX] = useAtom(atomHoveredX)
    const timeIntervalFactor = useAtomValue(atomTimeIntervalFactor)

    const hasHoveredEntity = hoveredEntity !== null

    const marks = useMemo(() => {
        const marks = [
            Plot.areaY(points, {
                x: "x",
                y: "y",
                fill: "region",
                z: "region",
                className: "income-plot-chart-area",
                // tip: "xy",
                title: "region",
                // stroke: "region",
                // strokeWidth: 1,
                // strokeOpacity: 1,
                fillOpacity: 0.3,
            }),
            Plot.areaY(points, {
                x: "x",
                y: "y",
                fill: "region",
                z: "region",
                className: "income-plot-chart-area--highlighted",
                // tip: "xy",
                title: "region",
                fillOpacity: { value: "region", scale: "opacity" },
            }),
            Plot.ruleY([0]),
            // Pointer ruler & axis text
            Plot.ruleX(
                points,
                Plot.pointerX({ x: "x", stroke: "red", strokeOpacity: 0.15 })
            ),
            Plot.text(
                points,
                Plot.pointerX({
                    x: "x",
                    text: (d) => formatCurrency(d.x * timeIntervalFactor),
                    fill: "red",
                    dy: 9,
                    frameAnchor: "bottom",
                    lineAnchor: "top",
                    stroke: "white",
                })
            ),
        ]

        // Add poverty line if enabled
        if (showPovertyLine) {
            marks.push(
                Plot.ruleX([povertyLine], {
                    stroke: "#d73027",
                    strokeWidth: 2,
                    strokeDasharray: "5,5",
                }),
                Plot.text([povertyLine], {
                    x: (d) => d,
                    text: () =>
                        `Poverty line: ${formatCurrency(povertyLine * timeIntervalFactor)}`,
                    fill: "#d73027",
                    dy: -10,
                    frameAnchor: "top-left",
                    fontWeight: "bold",
                })
            )
        }
        return marks
    }, [points, showPovertyLine, timeIntervalFactor, povertyLine])

    const plot = useMemo(() => {
        const plot = Plot.plot({
            x: {
                type: "log",
                grid: true,
                transform: (d) => d * timeIntervalFactor,
                tickFormat: formatCurrency,
                // label: `Income or consumption per day (int-$)`,
            },
            y: { axis: false },
            opacity: {
                type: "ordinal",
                domain: plotColorScale.domain,
                range: plotColorScale.domain?.map((entity) => {
                    if (!hasHoveredEntity) return 0.8
                    return entity === hoveredEntity ? 0.9 : 0
                }),
            },
            height,
            width,
            color: plotColorScale,
            marks,
            style,
        })

        plot.addEventListener("click", () => {
            if (!plot.value) return
            if (!showPovertyLine) setPovertyLine(plot.value.x.toFixed(2))
            setShowPovertyLine(!showPovertyLine)
        })

        // Attach hover listeners directly to the areas.
        // Using plot.value doesn't work well here, because they are using a radius
        // around the plotted data points, which makes it so that "center" of an area
        // sometimes doesn't show the hover state.
        plot.querySelectorAll(".income-plot-chart-area path").forEach(
            (area) => {
                const region = area.querySelector("title")?.textContent
                if (!region) return

                area.querySelector("title")?.remove()

                area.addEventListener("mousemove", () => {
                    setHoveredEntity(region)

                    if (plot.value?.x) setHoveredX(plot.value.x)
                    else setHoveredX(null)
                })
                area.addEventListener("mouseleave", () => {
                    setHoveredEntity(null)
                    setHoveredX(null)
                })
            }
        )
        plot.querySelectorAll(
            ".income-plot-chart-area--highlighted path"
        ).forEach((area) => {
            const elem = area as SVGElement
            elem.style.pointerEvents = "none"
        })

        plot.addEventListener("mouseleave", () => {
            setHoveredEntity(null)
            setHoveredX(null)
        })
        return plot
    }, [
        plotColorScale,
        height,
        width,
        marks,
        timeIntervalFactor,
        hasHoveredEntity,
        hoveredEntity,
        setHoveredX,
        showPovertyLine,
        setPovertyLine,
        setShowPovertyLine,
        setHoveredEntity,
    ])

    usePlot(plot, containerRef)

    const hoverRightThreshold = useMemo(() => {
        const activePovertyLine = showPovertyLine ? povertyLine : null
        return activePovertyLine ?? hoveredX
    }, [showPovertyLine, povertyLine, hoveredX])

    // When there's either a hoverX or a custom poverty line, only show
    // the left part of the highlighted area up to the line.
    // We do this using a clipPath, which is more efficient than filtering the data.
    useEffect(() => {
        const highlighted = plot.querySelector(
            ".income-plot-chart-area--highlighted"
        ) as SVGElement | null
        const xScale = plot.scale("x")
        if (highlighted && xScale) {
            const xRange = xScale.range as [number, number]

            if (hoverRightThreshold === null) {
                highlighted.style.clipPath = `none`
            } else {
                const clipX = hoverRightThreshold
                    ? xScale.apply(hoverRightThreshold) - xRange[0]
                    : 0
                highlighted.style.clipPath = `xywh(0 0 ${clipX}px 100%)`
            }
        }
    }, [plot, hoverRightThreshold])

    return (
        <>
            <div className="income-plot-chart" ref={containerRef}></div>
        </>
    )
}
