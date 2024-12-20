import React from "react"
import {
    VerticalColorLegend,
    VerticalColorLegendProps,
} from "./VerticalColorLegend"

export default {
    title: "VerticalColorLegend",
    component: VerticalColorLegend,
}

const props: VerticalColorLegendProps = {
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

export const CategoricalBins = (): React.ReactElement => {
    return (
        <svg width={600} height={400}>
            <VerticalColorLegend {...props} />
        </svg>
    )
}
