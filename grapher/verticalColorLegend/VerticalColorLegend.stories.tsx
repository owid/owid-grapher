import { CategoricalBin } from "grapher/color/ColorScaleBin"
import * as React from "react"
import {
    VerticalColorLegend,
    VerticalColorLegendOptionsProvider,
} from "./VerticalColorLegend"

export default {
    title: "VerticalColorLegend",
    component: VerticalColorLegend,
}

const options: VerticalColorLegendOptionsProvider = {
    maxLegendWidth: 500,
    title: "Legend Title",
    colorBins: [
        new CategoricalBin({
            index: 1,
            value: "North America",
            label: "Canada",
            color: "red",
        }),
        new CategoricalBin({
            index: 0,
            value: "North America",
            label: "Mexico",
            color: "green",
        }),
    ],
    activeColors: ["red", "green"],
}

export const Default = () => {
    return <VerticalColorLegend options={options} />
}
