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
    OwidChartDimensionInterfaceWithMandatorySlug,
    objectWithPersistablesToObject,
} from "@ourworldindata/utils"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"

// A chart "dimension" represents a binding between a chart
// and a particular variable that it requests as data
class ChartDimensionDefaults implements OwidChartDimensionInterface {
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
    implements Persistable, OwidChartDimensionInterfaceWithMandatorySlug
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
        const obj: OwidChartDimensionInterface = objectWithPersistablesToObject(
            this,
            keysToSerialize
        )

        deleteRuntimeAndUnchangedProps(obj, new ChartDimensionDefaults())

        // An authored slug is part of the config and has to survive the round
        // trip; a slug derived from the variable id is not.
        if (this._slug !== undefined) obj.slug = this._slug

        return trimObject(obj)
    }

    /**
     * The slug as authored, when the config named a column of the host's own
     * table. Indicator-backed dimensions leave this unset and derive their
     * slug from the variable id instead, which is why it is only written back
     * out in `toObject` when it was authored.
     */
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
