import React from "react"
import {
    VerticalColorLegend,
    VerticalColorLegendProps,
} from "./VerticalColorLegend"
import { VerticalColorLegendComponent } from "./VerticalColorLegendComponent"

export default {
    title: "VerticalColorLegend",
    component: VerticalColorLegend,
}

const props: VerticalColorLegendProps = {
    maxWidth: 500,
    legendTitle: "Legend Title",
    bins: [
        {
            type: "categorical",
            label: "Canada",
            color: "red",
        },
        {
            type: "categorical",
            label: "Mexico",
            color: "green",
        },
    ],
}

export const CategoricalBins = (): React.ReactElement => {
    const verticalColorLegend = new VerticalColorLegend(props)
    return (
        <svg width={600} height={400}>
            <VerticalColorLegendComponent
                legend={verticalColorLegend}
                activeColors={["red", "green"]}
            />
        </svg>
    )
}
