import * as React from "react"
import "charts/controls/scaleSelector.scss"

import { ScaleSelector } from "charts/controls/ScaleSelector"
import { ScaleType } from "charts/core/ChartConstants"
import { observable } from "mobx"

export default {
    title: "ScaleSelector",
    component: ScaleSelector
}

class ScaleConfig {
    @observable scaleType = ScaleType.log
    @observable scaleTypeOptions = [ScaleType.log, ScaleType.linear]
}

export const Default = () => {
    return <ScaleSelector x={0} y={0} scaleTypeConfig={new ScaleConfig()} />
}

export const StayInBounds = () => {
    return (
        <div
            style={{
                width: 200,
                height: 200,
                background: "gray",
                position: "relative"
            }}
        >
            <ScaleSelector
                x={190}
                maxX={200}
                y={0}
                scaleTypeConfig={new ScaleConfig()}
            />
        </div>
    )
}
