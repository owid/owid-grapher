import React from "react"
import {
    VerticalColorLegend,
    VerticalColorLegendManager,
} from "./VerticalColorLegend.js"

export default {
    title: "VerticalColorLegend",
    component: VerticalColorLegend,
}

const manager: VerticalColorLegendManager = {
    maxLegendWidth: 500,
    legendTitle: "Legend Title",
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

export const CategoricalBins = (): JSX.Element => {
    return (
        <svg width={600} height={400}>
            <VerticalColorLegend manager={manager} />
        </svg>
    )
}
