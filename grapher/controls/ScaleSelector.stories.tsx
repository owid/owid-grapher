import * as React from "react"
import {
    ScaleSelector,
    ScaleSelectorManager,
} from "grapher/controls/ScaleSelector"
import { ScaleType } from "grapher/core/GrapherConstants"
import { observable } from "mobx"
import { Bounds } from "grapher/utils/Bounds"

export default {
    title: "ScaleSelector",
    component: ScaleSelector,
}

class MockScaleSelectorManager implements ScaleSelectorManager {
    @observable scaleType = ScaleType.log
    bounds?: Bounds
    maxX?: number
}

export const Default = () => (
    <ScaleSelector manager={new MockScaleSelectorManager()} />
)

export const StayInBounds = () => {
    const manager = new MockScaleSelectorManager()
    manager.bounds = new Bounds(190, 0, 100, 100)
    manager.maxX = 200
    return (
        <svg width={200} height={200} style={{ position: "relative" }}>
            <rect width="100%" height="100%" fill="green" />
            <ScaleSelector manager={manager} />
        </svg>
    )
}
