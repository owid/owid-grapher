import * as React from "react"
import {
    ScaleSelector,
    ScaleSelectorManager,
} from "../controls/ScaleSelector.js"
import { ScaleType } from "../core/GrapherConstants.js"
import { observable } from "mobx"

export default {
    title: "ScaleSelector",
    component: ScaleSelector,
}

class MockScaleSelectorManager implements ScaleSelectorManager {
    @observable scaleType = ScaleType.log
}

export const Default = (): JSX.Element => (
    <ScaleSelector manager={new MockScaleSelectorManager()} />
)
