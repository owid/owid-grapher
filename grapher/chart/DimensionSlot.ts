// todo: remove

import { Grapher } from "../core/Grapher.js"
import { computed, makeObservable } from "mobx";
import { ChartDimension } from "./ChartDimension.js"
import { DimensionProperty } from "../../clientUtils/owidTypes.js"

export class DimensionSlot {
    private grapher: Grapher
    property: DimensionProperty
    constructor(grapher: Grapher, property: DimensionProperty) {
        makeObservable(this, {
            name: computed,
            allowMultiple: computed,
            isOptional: computed,
            dimensions: computed
        });

        this.grapher = grapher
        this.property = property
    }

    get name(): string {
        const names = {
            y: this.grapher.isDiscreteBar ? "X axis" : "Y axis",
            x: "X axis",
            size: "Size",
            color: "Color",
            filter: "Filter",
        }

        return (names as any)[this.property] || ""
    }

    get allowMultiple(): boolean {
        return (
            this.property === DimensionProperty.y &&
            this.grapher.supportsMultipleYColumns
        )
    }

    get isOptional(): boolean {
        return this.allowMultiple
    }

    get dimensions(): ChartDimension[] {
        return this.grapher.dimensions.filter(
            (d) => d.property === this.property
        )
    }
}
