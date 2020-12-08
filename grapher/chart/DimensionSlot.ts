// todo: remove

import { Grapher } from "../core/Grapher"
import { computed } from "mobx"
import { DimensionProperty } from "../core/GrapherConstants"
import { excludeUndefined, findIndex, sortBy } from "../../clientUtils/Util"

export class DimensionSlot {
    private grapher: Grapher
    property: DimensionProperty
    constructor(grapher: Grapher, property: DimensionProperty) {
        this.grapher = grapher
        this.property = property
    }

    @computed get name() {
        const names = {
            y: this.grapher.isDiscreteBar ? "X axis" : "Y axis",
            x: "X axis",
            size: "Size",
            color: "Color",
            filter: "Filter",
        }

        return (names as any)[this.property] || ""
    }

    @computed get allowMultiple() {
        return (
            this.property === DimensionProperty.y &&
            this.grapher.supportsMultipleYColumns
        )
    }

    @computed get isOptional() {
        return this.allowMultiple
    }

    @computed get dimensions() {
        return this.grapher.dimensions.filter(
            (d) => d.property === this.property
        )
    }

    @computed get dimensionsWithData() {
        const legacyConfig = this.grapher.legacyConfigAsAuthored
        const selectionOrder = excludeUndefined(
            legacyConfig.selectedData?.map((item) => {
                return legacyConfig.dimensions?.[item.index].variableId
            }) ?? []
        )
        const dimensions = sortBy(
            this.grapher.filledDimensions || [],
            (dim) => {
                const idx = findIndex(
                    selectionOrder,
                    (variableId) => dim.variableId === variableId
                )
                return idx
            }
        )
        return dimensions.filter((d) => d.property === this.property)
    }
}
