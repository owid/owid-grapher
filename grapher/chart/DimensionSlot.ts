// todo: remove

import { Grapher } from "../core/Grapher.js"
import { computed } from "mobx"
import { ChartDimension } from "./ChartDimension.js"
import { DimensionProperty } from "../../clientUtils/owidTypes.js"

export class DimensionSlot {
    private grapher: Grapher
    property: DimensionProperty
    constructor(grapher: Grapher, property: DimensionProperty) {
        this.grapher = grapher
        this.property = property
    }

    @computed get name(): string {
        const names = {
            y: this.grapher.isDiscreteBar ? "X axis" : "Y axis",
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
            this.grapher.supportsMultipleYColumns
        )
    }

    @computed get isOptional(): boolean {
        return this.allowMultiple
    }

    @computed get dimensions(): ChartDimension[] {
        return this.grapher.dimensions.filter(
            (d) => d.property === this.property
        )
    }
}
