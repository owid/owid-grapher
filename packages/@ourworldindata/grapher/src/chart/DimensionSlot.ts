// todo: remove

import { Grapher, GrapherState } from "../core/Grapher"
import { computed } from "mobx"
import { ChartDimension } from "./ChartDimension"
import { DimensionProperty } from "@ourworldindata/utils"

export class DimensionSlot {
    private grapherState: GrapherState
    property: DimensionProperty
    constructor(grapher: GrapherState, property: DimensionProperty) {
        this.grapherState = grapher
        this.property = property
    }

    @computed get name(): string {
        const names = {
            y: this.grapherState.isDiscreteBar ? "X axis" : "Y axis",
            x: "X axis",
            size: "Size",
            color: "Color",
            filter: "Filter",
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
