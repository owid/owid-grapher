// Todo: remove this.
// Any display changes really can be computed columns. And then charts just need xColumnSlug, sizeColumnSlug, yColumnSlug (or yColumnSlugs) et cetera

import { observable, computed } from "mobx"
import { trimObject } from "clientUtils/Util"
import { DimensionProperty } from "grapher/core/GrapherConstants"
import { OwidTable } from "coreTable/OwidTable"
import {
    LegacyChartDimensionInterface,
    LegacyVariableDisplayConfig,
} from "grapher/core/LegacyVariableCode"
import { LegacyVariableId } from "clientUtils/owidTypes"
import { ColumnSlug, Time } from "coreTable/CoreTableConstants"
import {
    Persistable,
    deleteRuntimeAndUnchangedProps,
    updatePersistables,
} from "grapher/persistable/Persistable"

// A chart "dimension" represents a binding between a chart
// and a particular variable that it requests as data
class ChartDimensionDefaults implements LegacyChartDimensionInterface {
    @observable property!: DimensionProperty
    @observable variableId!: LegacyVariableId

    // check on: malaria-deaths-comparisons and computing-efficiency

    @observable display = new LegacyVariableDisplayConfig() // todo: make persistable

    // XXX move this somewhere else, it's only used for scatter x override
    @observable targetYear?: Time = undefined
}

// todo: remove when we remove dimensions
export interface LegacyDimensionsManager {
    table: OwidTable
}

export class ChartDimension
    extends ChartDimensionDefaults
    implements Persistable {
    private manager: LegacyDimensionsManager

    constructor(
        obj: LegacyChartDimensionInterface,
        manager: LegacyDimensionsManager
    ) {
        super()
        this.manager = manager
        if (obj) this.updateFromObject(obj)
    }

    @computed private get table() {
        return this.manager.table
    }

    updateFromObject(obj: LegacyChartDimensionInterface) {
        if (obj.display) updatePersistables(this, { display: obj.display })

        this.targetYear = obj.targetYear
        this.variableId = obj.variableId
        this.property = obj.property
        this.slug = obj.slug
    }

    toObject(): LegacyChartDimensionInterface {
        return trimObject(
            deleteRuntimeAndUnchangedProps(
                {
                    property: this.property,
                    variableId: this.variableId,
                    display: this.display,
                    targetYear: this.targetYear,
                },
                new ChartDimensionDefaults()
            )
        )
    }

    // Do not persist yet, until we migrate off VariableIds
    @observable slug?: ColumnSlug

    @computed get column() {
        return this.table.get(this.columnSlug)
    }

    @computed get columnSlug() {
        return this.slug ?? this.variableId.toString()
    }
}
