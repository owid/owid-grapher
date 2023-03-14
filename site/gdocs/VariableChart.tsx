import React, { useRef } from "react"
import { useEmbedChart, useEmbedVariableChart } from "../hooks.js"
import { EnrichedBlockVariableChart, Url } from "@ourworldindata/utils"
import { renderSpans } from "./utils.js"
import cx from "classnames"

export default function VariableChart({
    d,
    className,
}: {
    d: EnrichedBlockVariableChart
    className?: string
}) {
    const ref = useRef<HTMLElement>(null)
    useEmbedVariableChart(d.variable, d.chartType, d.hideTabs, ref)
    return <figure className={className} ref={ref}></figure>
}
