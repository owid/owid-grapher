// Todo: remove this.
// Any display changes really can be computed columns. And then charts just need xColumnSlug, sizeColumnSlug, yColumnSlug (or yColumnSlugs) et cetera

import { observable, computed } from "mobx"
import { trimObject } from "grapher/utils/Util"
import { DimensionProperty, Time } from "grapher/core/GrapherConstants"
import { OwidTable } from "coreTable/OwidTable"
import { LoadingColumn } from "coreTable/CoreTable"

import {
    LegacyVariableDisplayConfigInterface,
    LegacyVariableDisplayConfig,
    OwidSource,
    LegacyVariableId,
} from "coreTable/LegacyVariableCode"
import { ColumnSlug } from "coreTable/CoreTableConstants"
import {
    Persistable,
    deleteRuntimeAndUnchangedProps,
    objectWithPersistablesToObject,
    updatePersistables,
} from "grapher/persistable/Persistable"

export interface SourceWithDimension {
    source: OwidSource
    dimension: ChartDimension
}

export interface ChartDimensionInterface {
    property: DimensionProperty
    targetTime?: Time
    display?: LegacyVariableDisplayConfigInterface
    variableId: LegacyVariableId
    slug?: ColumnSlug
}

// A chart "dimension" represents a binding between a chart
// and a particular variable that it requests as data
class ChartDimensionDefaults implements ChartDimensionInterface {
    @observable property!: DimensionProperty
    @observable variableId!: LegacyVariableId

    // check on: malaria-deaths-comparisons and computing-efficiency

    @observable display = new LegacyVariableDisplayConfig() // todo: make persistable

    // XXX move this somewhere else, it's only used for scatter x override
    @observable targetTime?: Time = undefined
}

export class ChartDimension
    extends ChartDimensionDefaults
    implements Persistable {
    @observable.ref private table: OwidTable

    constructor(obj: ChartDimensionInterface, table: OwidTable) {
        super()
        this.table = table
        if (obj) this.updateFromObject(obj)
    }

    updateFromObject(obj: ChartDimensionInterface) {
        updatePersistables(this, obj)

        this.targetTime = obj.targetTime
        this.variableId = obj.variableId
        this.property = obj.property
    }

    toObject(): ChartDimensionInterface {
        return trimObject(
            deleteRuntimeAndUnchangedProps(
                objectWithPersistablesToObject(this),
                new ChartDimensionDefaults()
            )
        )
    }

    // Do not persist yet, until we migrate off VariableIds
    @observable slug?: ColumnSlug

    @computed get column() {
        return (
            this.table.columnsBySlug.get(this.columnSlug) ||
            new LoadingColumn(this.table, {
                slug: this.variableId?.toString() || "loading",
            })
        )
    }

    @computed get columnSlug() {
        return this.slug ?? this.variableId.toString()
    }
}
