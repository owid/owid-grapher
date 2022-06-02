import React from "react"
import { MapTooltip } from "./MapTooltip.js"
import { Grapher } from "../core/Grapher.js"
import { legacyMapGrapher } from "./MapChart.sample.js"

export default {
    title: "MapTooltip",
    component: MapTooltip,
}

// todo: refactor TooltipContainer stuff so we can decouple from Grapher
export const WithSparkChart = (): JSX.Element => (
    <Grapher {...legacyMapGrapher} />
)
