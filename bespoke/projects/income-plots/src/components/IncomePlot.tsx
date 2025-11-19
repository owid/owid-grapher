import * as Plot from "@observablehq/plot"
import {
    formatCurrency,
    kdeLog,
    REGION_COLORS,
} from "../utils/incomePlotUtils.ts"
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

const plotIncome = (data: typeof points) =>
    Plot.plot({
        x: {
            type: "log",
            grid: true,
            tickFormat: formatCurrency,
            // label: `Income or consumption per ${currentIntervalLowercase} (int-$)`,
        },
        y: { axis: false },
        height: 600,
        width: 1000,
        color: {
            ...regionsScale,
            style,
        },
        marks: [
            Plot.areaY(data, {
                x: "x",
                y: "y",
                fill: "region",
            }),

            Plot.ruleY([0]),

            // Pointer ruler & axis text
            Plot.ruleX(
                data,
                Plot.pointerX({ x: "x", stroke: "red", strokeOpacity: 0.15 })
            ),
            Plot.text(
                data,
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
        ],
        style,
    })

export const plot = () => plotIncome(points)
