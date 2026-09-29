import { observable, computed, makeObservable } from "mobx"
import {
    trimObject,
    ColumnSlug,
    DimensionProperty,
    OwidVariableId,
    Persistable,
    deleteRuntimeAndUnchangedProps,
    updatePersistables,
    OwidVariableDisplayConfig,
    OwidChartDimensionInterface,
    Time,
    objectWithPersistablesToObject,
} from "@ourworldindata/utils"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"

// A chart "dimension" represents a binding between a chart
// and a particular variable that it requests as data
class ChartDimensionDefaults {
    property!: DimensionProperty
    // Undefined when the slot names a host-supplied column by slug instead.
    variableId?: OwidVariableId

    // check on: malaria-deaths-comparisons and computing-efficiency

    display = new OwidVariableDisplayConfig() // todo: make persistable

    // XXX move this somewhere else, it's only used for scatter x override and Marimekko override
    targetYear: Time | undefined = undefined

    constructor() {
        makeObservable(this, {
            property: observable,
            variableId: observable,
            display: observable,
            targetYear: observable,
        })
    }
}

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

export class ChartDimension
    extends ChartDimensionDefaults
    implements Persistable
{
    private readonly manager: LegacyDimensionsManager

    constructor(
        obj: OwidChartDimensionInterface,
        manager: LegacyDimensionsManager
    ) {
        super()

        makeObservable(this, {
            _slug: observable,
        })
        this.manager = manager
        if (obj) this.updateFromObject(obj)
    }

    @computed private get table(): OwidTable {
        return this.manager.table
    }

    updateFromObject(obj: OwidChartDimensionInterface): void {
        if (obj.display) updatePersistables(this, { display: obj.display })

        this.targetYear = obj.targetYear
        this.variableId = obj.variableId
        this.property = obj.property
        this.slug = obj.slug
    }

    toObject(): OwidChartDimensionInterface {
        const keysToSerialize = [
            "variableId",
            "property",
            "display",
            "targetYear",
        ]
        const obj: Partial<ChartDimensionDefaults> & { slug?: ColumnSlug } =
            objectWithPersistablesToObject(this, keysToSerialize)

        deleteRuntimeAndUnchangedProps(obj, new ChartDimensionDefaults())

        // An authored slug is part of the config; a derived one is not
        if (this._slug !== undefined) obj.slug = this._slug

        return trimObject(obj) as OwidChartDimensionInterface
    }

    /** The slug as authored, set only when the slot names a host column */
    _slug: ColumnSlug | undefined = undefined

    @computed get slug(): ColumnSlug {
        if (this._slug) return this._slug
        if (this.variableId === undefined) return ""
        return getDimensionColumnSlug(this.variableId, this.targetYear)
    }

    set slug(value: ColumnSlug | undefined) {
        this._slug = value
    }

    @computed get column(): CoreColumn {
        return this.table.get(this.columnSlug)
    }

    @computed get columnSlug(): string {
        return this.slug
    }
}
