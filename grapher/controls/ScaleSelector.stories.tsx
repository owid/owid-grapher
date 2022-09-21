import React from "react"
import {
    ScaleSelector,
    ScaleSelectorManager,
} from "../controls/ScaleSelector.js"
import { ScaleType } from "../core/GrapherConstants.js"
import { observable, makeObservable } from "mobx";

export default {
    title: "ScaleSelector",
    component: ScaleSelector,
}

class MockScaleSelectorManager implements ScaleSelectorManager {
    scaleType = ScaleType.log;

    constructor() {
        makeObservable(this, {
            scaleType: observable
        });
    }
}

export const Default = (): JSX.Element => (
    <ScaleSelector manager={new MockScaleSelectorManager()} />
)
