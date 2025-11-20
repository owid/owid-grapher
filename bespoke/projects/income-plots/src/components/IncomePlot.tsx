import { useMemo, useRef } from "react"
import { useAtom, useAtomValue } from "jotai"
import * as Plot from "@observablehq/plot"
import { formatCurrency, usePlot } from "../utils/incomePlotUtils.ts"
import {
    atomCustomPovertyLine,
    atomKdeDataForYear,
    atomPlotColorScale,
    atomShowCustomPovertyLine,
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
    const points = useAtomValue(atomKdeDataForYear)
    const [povertyLine, setPovertyLine] = useAtom(atomCustomPovertyLine)
    const [showPovertyLine, setShowPovertyLine] = useAtom(
        atomShowCustomPovertyLine
    )
    const plotColorScale = useAtomValue(atomPlotColorScale)

    const marks = useMemo(() => {
        const marks = [
            Plot.areaY(points, {
                x: "x",
                y: "y",
                fill: "region",
                fillOpacity: 0.8,
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
                    text: (d) => formatCurrency(d.x),
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
                    text: () => `Poverty line: ${formatCurrency(povertyLine)}`,
                    fill: "#d73027",
                    dy: -10,
                    frameAnchor: "top-left",
                    fontWeight: "bold",
                })
            )
        }
        return marks
    }, [points, povertyLine, showPovertyLine])

    const plot = useMemo(() => {
        const plot = Plot.plot({
            x: {
                type: "log",
                grid: true,
                tickFormat: formatCurrency,
                // label: `Income or consumption per day (int-$)`,
            },
            y: { axis: false },
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
        return plot
    }, [
        marks,
        width,
        height,
        setPovertyLine,
        showPovertyLine,
        setShowPovertyLine,
        plotColorScale,
    ])

    usePlot(plot, containerRef)

    return (
        <>
            <div ref={containerRef}></div>
        </>
    )
}
