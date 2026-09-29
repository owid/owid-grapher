import { observable, computed, makeObservable } from "mobx"
import {
    trimObject,
    ColumnSlug,
    DimensionProperty,
    OwidVariableId,
    Persistable,
    updatePersistables,
    OwidVariableDisplayConfig,
    OwidChartDimensionInterface,
    Time,
} from "@ourworldindata/utils"
import {
    type SlugDimensionInterface,
    type IndicatorDimensionInterface,
    isIndicatorDimension,
} from "@ourworldindata/types"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"

/** The part of a slot that names its column */
type DimensionColumnSource =
    | Pick<IndicatorDimensionInterface, "variableId" | "targetYear">
    | Pick<SlugDimensionInterface, "slug">

// todo: remove when we remove dimensions
export interface LegacyDimensionsManager {
    table: OwidTable
}

export function getDimensionColumnSlug(
    variableId: OwidVariableId,
    targetYear: Time | undefined
): ColumnSlug {
    if (targetYear) return `${variableId}-${targetYear}`
    return variableId.toString()
}

// A chart "dimension" represents a binding between a chart
// and a particular variable that it requests as data
export class ChartDimension implements Persistable {
    property!: DimensionProperty

    // check on: malaria-deaths-comparisons and computing-efficiency

    display = new OwidVariableDisplayConfig() // todo: make persistable

    source!: DimensionColumnSource

    private readonly manager: LegacyDimensionsManager

    constructor(
        obj: OwidChartDimensionInterface,
        manager: LegacyDimensionsManager
    ) {
        makeObservable(this, {
            property: observable,
            display: observable,
            source: observable.ref,
        })
        this.manager = manager
        this.updateFromObject(obj)
    }

    @computed private get table(): OwidTable {
        return this.manager.table
    }

    updateFromObject(obj: OwidChartDimensionInterface): void {
        if (obj.display) updatePersistables(this, { display: obj.display })

        this.property = obj.property
        this.source = isIndicatorDimension(obj)
            ? { variableId: obj.variableId, targetYear: obj.targetYear }
            : { slug: obj.slug }
    }

    toObject(): OwidChartDimensionInterface {
        return trimObject({
            property: this.property,
            display: this.display.toObject(),
            ...this.source,
        })
    }

    @computed get variableId(): OwidVariableId | undefined {
        return "variableId" in this.source ? this.source.variableId : undefined
    }

    // XXX move this somewhere else, it's only used for scatter x override and Marimekko override
    @computed get targetYear(): Time | undefined {
        return "variableId" in this.source ? this.source.targetYear : undefined
    }

    set targetYear(value: Time | undefined) {
        if (!("variableId" in this.source)) {
            if (value === undefined) return
            throw new Error(
                `Cannot pin host column "${this.source.slug}" to a year; targetYear needs a variableId dimension`
            )
        }
        this.source = { ...this.source, targetYear: value }
    }

    @computed get column(): CoreColumn {
        return this.table.get(this.columnSlug)
    }

    @computed get columnSlug(): ColumnSlug {
        return "variableId" in this.source
            ? getDimensionColumnSlug(
                  this.source.variableId,
                  this.source.targetYear
              )
            : this.source.slug
    }
}
