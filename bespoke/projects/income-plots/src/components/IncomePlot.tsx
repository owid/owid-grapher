import { useEffect, useRef } from "react"
import { useAtom } from "jotai"
import * as Plot from "@observablehq/plot"
import {
    formatCurrency,
    kdeLog,
    REGION_COLORS,
} from "../utils/incomePlotUtils.ts"
import { customPovertyLineAtom, showCustomPovertyLineAtom } from "../store.ts"
import data from "../data/incomeBins.json"
import * as R from "remeda"

const dataTyped = data as Array<{
    country: string
    region: string
    year: number
    pop: number
    avgsLog2Times100: number[]
}>

const incomeData = R.pipe(
    dataTyped,
    R.filter((d) => d.year === 2021),
    R.map((d) => ({
        ...d,
        avgsLog2: d.avgsLog2Times100.map((v) => v / 100),
    })),
    R.sortBy(R.prop("region"))
)

const points = incomeData.flatMap((record) => {
    const common = R.omit(record, ["avgsLog2Times100", "avgsLog2"])
    const kdeRes = kdeLog(record.avgsLog2)
    return kdeRes.map((kde) => ({
        ...common,
        ...kde,
        y: kde.y * common.pop,
        // yNotScaledByPop: (kde.y * common.pop) / totalPopulation[common.region],
    }))
})

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
    const [povertyLine] = useAtom(customPovertyLineAtom)
    const [showPovertyLine] = useAtom(showCustomPovertyLineAtom)

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

        container.appendChild(plot)

        // Cleanup function
        return () => plot.remove()
    }, [povertyLine, showPovertyLine, width, height])

    return <div ref={containerRef} />
}
