import { ChartRuntime } from "./ChartRuntime"
import {
    dimensionProperty,
    ChartDimensionSpec,
    ChartDimension
} from "./ChartDimension"
import { computed } from "mobx"

export class DimensionSlot {
    chart: ChartRuntime
    property: dimensionProperty
    constructor(chart: ChartRuntime, property: dimensionProperty) {
        this.chart = chart
        this.property = property
    }

    @computed get name(): string {
        const names = {
            y: this.chart.isDiscreteBar ? "X axis" : "Y axis",
            x: "X axis",
            size: "Size",
            color: "Color",
            filter: "Filter"
        }

        return (names as any)[this.property] || ""
    }

    @computed get allowMultiple(): boolean {
        return (
            this.property === "y" &&
            !(
                this.chart.isScatter ||
                this.chart.isTimeScatter ||
                this.chart.isSlopeChart
            )
        )
    }

    @computed get isOptional(): boolean {
        return this.allowMultiple
    }

    @computed get dimensions(): ChartDimensionSpec[] {
        return this.chart.dimensions.filter(d => d.property === this.property)
    }

    set dimensions(dims: ChartDimensionSpec[]) {
        let newDimensions: ChartDimensionSpec[] = []
        this.chart.dimensionSlots.forEach(slot => {
            if (slot.property === this.property)
                newDimensions = newDimensions.concat(dims)
            else newDimensions = newDimensions.concat(slot.dimensions)
        })
        this.chart.script.dimensions = newDimensions
    }

    @computed get dimensionsWithData(): ChartDimension[] {
        return this.chart.filledDimensions.filter(
            d => d.property === this.property
        )
    }

    createDimension(variableId: number) {
        return new ChartDimensionSpec({ property: this.property, variableId })
    }
}
