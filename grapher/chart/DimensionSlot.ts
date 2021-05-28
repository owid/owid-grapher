// todo: remove

import { Grapher } from "../core/Grapher"
import { computed } from "mobx"
import { DimensionProperty } from "../core/GrapherConstants"
import { excludeUndefined, findIndex, sortBy } from "../../clientUtils/Util"
import { ChartDimension } from "./ChartDimension"

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

    @computed get dimensionsOrderedAsInPersistedSelection(): ChartDimension[] {
        const legacyConfig = this.grapher.legacyConfigAsAuthored
        const variableIDsInSelectionOrder = excludeUndefined(
            legacyConfig.selectedData?.map(
                (item) => legacyConfig.dimensions?.[item.index]?.variableId
            ) ?? []
        )
        return sortBy(this.grapher.filledDimensions || [], (dim) =>
            findIndex(
                variableIDsInSelectionOrder,
                (variableId) => dim.variableId === variableId
            )
        ).filter((dim) => dim.property === this.property)
    }
}
