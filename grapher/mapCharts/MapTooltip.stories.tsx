import * as React from "react"
import { MapTooltip } from "./MapTooltip"
import { Grapher } from "grapher/core/Grapher"
import { legacyMapGrapher } from "./MapChart.sample"

export default {
    title: "MapTooltip",
    component: MapTooltip,
}

// todo: refactor TooltipView stuff so we can decouple from Grapher
export const WithSparkChart = () => <Grapher {...legacyMapGrapher} />
