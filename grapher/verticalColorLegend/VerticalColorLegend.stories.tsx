import * as React from "react"
import {
    VerticalColorLegend,
    VerticalColorLegendManager,
} from "./VerticalColorLegend"

export default {
    title: "VerticalColorLegend",
    component: VerticalColorLegend,
}

const manager: VerticalColorLegendManager = {
    maxLegendWidth: 500,
    title: "Legend Title",
    legendItems: [
        {
            label: "Canada",
            color: "red",
        },
        {
            label: "Mexico",
            color: "green",
        },
    ],
    activeColors: ["red", "green"],
}

export const CategoricalBins = () => {
    return (
        <svg width={600} height={400}>
            <VerticalColorLegend manager={manager} />
        </svg>
    )
}
