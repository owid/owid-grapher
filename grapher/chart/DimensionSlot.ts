import { Grapher } from "grapher/core/Grapher"
import {
    dimensionProperty,
    ChartDimensionSpec,
    ChartDimension,
} from "./ChartDimension"
import { computed } from "mobx"

export class DimensionSlot {
    grapher: Grapher
    property: dimensionProperty
    constructor(grapher: Grapher, property: dimensionProperty) {
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
            this.property === "y" &&
            !(
                this.grapher.isScatter ||
                this.grapher.isTimeScatter ||
                this.grapher.isSlopeChart
            )
        )
    }

    @computed get isOptional(): boolean {
        return this.allowMultiple
    }

    @computed get dimensions(): ChartDimensionSpec[] {
        return this.grapher.dimensions.filter(
            (d) => d.property === this.property
        )
    }

    set dimensions(dims: ChartDimensionSpec[]) {
        let newDimensions: ChartDimensionSpec[] = []
        this.grapher.dimensionSlots.forEach((slot) => {
            if (slot.property === this.property)
                newDimensions = newDimensions.concat(dims)
            else newDimensions = newDimensions.concat(slot.dimensions)
        })
        this.grapher.dimensions = newDimensions
    }

    @computed get dimensionsWithData(): ChartDimension[] {
        return this.grapher.filledDimensions.filter(
            (d) => d.property === this.property
        )
    }

    createDimension(variableId: number) {
        return new ChartDimensionSpec({ property: this.property, variableId })
    }
}
