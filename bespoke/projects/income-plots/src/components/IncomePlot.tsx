import * as Plot from "@observablehq/plot"
import { formatCurrency, kdeLog } from "../utils/incomePlotUtils.ts"
import data from "../data/incomeBins.json"
import * as R from "remeda"

console.log("data", data)

const incomeData = R.pipe(
    data,
    R.filter((d) => d.year === 2021),
    R.map((d) => ({
        ...d,
        avgsLog2: d.avgsLog2Times100.map((v) => v / 100),
    })),
    R.sortBy(R.prop("region"))
)

const incomeData2 = data
    .filter((d) => d.year === 2021)
    .map((d) => ({
        ...d,
        avgsLog2: d.avgsLog2Times100.map((v) => v / 100),
    }))
const points = incomeData.flatMap((record) => {
    console.log("record", record)
    const common = R.omit(record, ["avgsLog2Times100", "avgsLog2"])
    const kdeRes = kdeLog(record.avgsLog2)
    return kdeRes.map((kde) => ({
        ...common,
        ...kde,
        y: kde.y * common.pop,
        // yNotScaledByPop: (kde.y * common.pop) / totalPopulation[common.region],
    }))
})

console.log("points", points)

const plotIncome = (data) =>
    Plot.plot({
        x: {
            type: "log",
            grid: true,
            tickFormat: formatCurrency,
            // label: `Income or consumption per ${currentIntervalLowercase} (int-$)`,
        },
        y: { axis: false },
        // height: CHART_HEIGHT,
        width: 1000,
        // color: { ...regionsScale, legend: true },
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
    })

export const plot = () => plotIncome(points)
