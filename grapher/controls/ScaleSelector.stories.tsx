import * as React from "react"
import {
    ScaleSelector,
    ScaleSelectorManager,
} from "grapher/controls/ScaleSelector"
import { ScaleType } from "grapher/core/GrapherConstants"
import { observable } from "mobx"

export default {
    title: "ScaleSelector",
    component: ScaleSelector,
}

class MockScaleSelectorManager implements ScaleSelectorManager {
    @observable scaleType = ScaleType.log
    @observable scaleTypeOptions = [ScaleType.log, ScaleType.linear]
    x = 0
    y = 0
    maxX?: number
}

export const Default = () => (
    <ScaleSelector manager={new MockScaleSelectorManager()} />
)

export const StayInBounds = () => {
    const manager = new MockScaleSelectorManager()
    manager.x = 190
    manager.maxX = 200
    return (
        <div
            style={{
                width: 200,
                height: 200,
                background: "gray",
                position: "relative",
            }}
        >
            <ScaleSelector manager={manager} />
        </div>
    )
}
