import { useEffect, useRef } from "react"
import { useAtom, useAtomValue } from "jotai"
import * as Plot from "@observablehq/plot"
import { formatCurrency, REGION_COLORS } from "../utils/incomePlotUtils.ts"
import {
    atomCustomPovertyLine,
    atomKdeDataForYear,
    atomShowCustomPovertyLine,
} from "../store.ts"

const regionsScale: Plot.ScaleOptions = {
    domain: Object.keys(REGION_COLORS),
    range: Object.values(REGION_COLORS),
    legend: true,
}

const style = {
    fontFamily:
        'Lato, "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif',
    fontSize: "11.5px",
}

interface IncomePlotProps {
    width?: number
    height?: number
}

export function IncomePlot({ width = 1000, height = 600 }: IncomePlotProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const points = useAtomValue(atomKdeDataForYear)
    const [povertyLine, setPovertyLine] = useAtom(atomCustomPovertyLine)
    const [showPovertyLine, setShowPovertyLine] = useAtom(
        atomShowCustomPovertyLine
    )

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const marks = [
            Plot.areaY(points, {
                x: "x",
                y: "y",
                fill: "region",
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
            color: regionsScale,
            marks,
            style,
        })

        plot.addEventListener("click", (event) => {
            if (!plot.value) return
            if (!showPovertyLine) setPovertyLine(plot.value.x.toFixed(2))
            setShowPovertyLine(!showPovertyLine)
        })

        container.appendChild(plot)

        // Cleanup function
        return () => plot.remove()
    }, [povertyLine, showPovertyLine, width, height])

    return (
        <>
            <div ref={containerRef}></div>
        </>
    )
}
