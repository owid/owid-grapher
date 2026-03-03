// todo: remove

import { GrapherState } from "../core/GrapherState"
import { computed, makeObservable } from "mobx"
import { ChartDimension } from "./ChartDimension"
import { DimensionProperty } from "@ourworldindata/utils"

export class DimensionSlot {
    private grapherState: GrapherState
    property: DimensionProperty
    constructor(grapher: GrapherState, property: DimensionProperty) {
        makeObservable(this)
        this.grapherState = grapher
        this.property = property
    }

    @computed get name(): string {
        const names: Record<DimensionProperty, string> = {
            y: "Y axis",
            x: "X axis",
            size: "Size",
            color: "Color",
            table: "Table",
        }

        return (names as any)[this.property] || ""
    }

    @computed get allowMultiple(): boolean {
        return (
            this.property === DimensionProperty.y &&
            this.grapherState.supportsMultipleYColumns
        )
    }

    @computed get isOptional(): boolean {
        return this.allowMultiple
    }

    @computed get dimensions(): ChartDimension[] {
        return this.grapherState.dimensions.filter(
            (d) => d.property === this.property
        )
    }
}
