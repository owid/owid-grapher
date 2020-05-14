import * as React from "react"
import { observer } from "mobx-react"
import { SparkBars, SparkBarsProps } from "charts/SparkBars"

export type CovidBarsProps<T> = SparkBarsProps<T>

function CovidBars<T>(props: CovidBarsProps<T>) {
    return <SparkBars<T> {...props} className="covid-bars" />
}

export default observer(CovidBars)
