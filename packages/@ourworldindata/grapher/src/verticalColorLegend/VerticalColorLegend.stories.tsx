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
    const verticalColorLegend = new VerticalColorLegend(props)
    return (
        <svg width={600} height={400}>
            <VerticalColorLegendComponent state={verticalColorLegend} />
        </svg>
    )
}
