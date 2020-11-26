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
}

export const Default = () => (
    <ScaleSelector manager={new MockScaleSelectorManager()} />
)
