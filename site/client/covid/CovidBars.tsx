import * as React from "react"
import { observer } from "mobx-react"
import { SparkBars } from "charts/SparkBars"

export interface CovidBarsProps<T> {
    data: T[]
    x: (d: T) => number
    y: (d: T) => number | undefined
    xDomain: [number, number]
    currentX?: number
    highlightedX?: number
    renderValue?: (d: T | undefined) => JSX.Element | undefined
    onHover?: (d: T | undefined, index: number | undefined) => void
}

function CovidBars<T>(props: CovidBarsProps<T>) {
    return <SparkBars<T> {...props} className="covid-bars" />
}

export default observer(CovidBars)
