import { useMemo, useRef } from "react"
import { useAtom, useAtomValue } from "jotai"
import * as Plot from "@observablehq/plot"
import { formatCurrency, usePlot } from "../utils/incomePlotUtils.ts"
import {
    atomCustomPovertyLine,
    atomHoveredEntity,
    atomKdeDataForYearGroupedByRegion,
    atomPlotColorScale,
    atomShowCustomPovertyLine,
    atomTimeIntervalFactor,
} from "../store.ts"

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
                tip: "xy",
                title: () => "",
                // stroke: "region",
                // strokeWidth: 1,
                // strokeOpacity: 1,
                fillOpacity: { value: "region", scale: "opacity" },
            }),
            Plot.ruleY([0]),
            // Pointer ruler & axis text
            // Plot.ruleX(
            //     points,
            //     Plot.pointerX({ x: "x", stroke: "red", strokeOpacity: 0.15 })
            // ),
            // Plot.text(
            //     points,
            //     Plot.pointerX({
            //         x: "x",
            //         text: (d) => formatCurrency(d.x),
            //         fill: "red",
            //         dy: 9,
            //         frameAnchor: "bottom",
            //         lineAnchor: "top",
            //         stroke: "white",
            //     })
            // ),
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
                    text: () => `Poverty line: ${formatCurrency(povertyLine)}`,
                    fill: "#d73027",
                    dy: -10,
                    frameAnchor: "top-left",
                    fontWeight: "bold",
                })
            )
        }
        return marks
    }, [points, showPovertyLine, povertyLine])

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
                    return entity === hoveredEntity ? 0.9 : 0.4
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

        plot.addEventListener("mousemove", () => {
            setHoveredEntity(plot.value?.region ?? null)
        })

        plot.addEventListener("mouseleave", () => {
            setHoveredEntity(null)
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
        showPovertyLine,
        setPovertyLine,
        setShowPovertyLine,
        setHoveredEntity,
    ])

    usePlot(plot, containerRef)

    return (
        <>
            <div className="income-plot-chart" ref={containerRef}></div>
        </>
    )
}
