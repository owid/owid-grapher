import { observable, makeObservable } from "mobx"
import {
    SortOrder,
    SwimlaneChartConfigInterface,
    SwimlaneSortBy,
} from "@ourworldindata/types"
import {
    Persistable,
    updatePersistables,
    objectWithPersistablesToObject,
    deleteRuntimeAndUnchangedProps,
    trimObject,
    NoUndefinedValues,
} from "@ourworldindata/utils"

export const SWIMLANE_CHART_CONFIG_DEFAULTS: Required<SwimlaneChartConfigInterface> =
    {
        sortBy: SwimlaneSortBy.lastCategory,
        sortOrder: SortOrder.desc,
    }

class SwimlaneChartConfigDefaults {
    sortBy: SwimlaneSortBy = SWIMLANE_CHART_CONFIG_DEFAULTS.sortBy
    sortOrder: SortOrder = SWIMLANE_CHART_CONFIG_DEFAULTS.sortOrder

    constructor() {
        makeObservable(this, {
            sortBy: observable.ref,
            sortOrder: observable.ref,
        })
    }
}

export class SwimlaneChartConfig
    extends SwimlaneChartConfigDefaults
    implements Persistable
{
    updateFromObject(obj: Partial<SwimlaneChartConfigInterface>): void {
        updatePersistables(this, obj)
    }

    toObject(): NoUndefinedValues<SwimlaneChartConfigInterface> {
        const obj = objectWithPersistablesToObject(
            this
        ) as SwimlaneChartConfigInterface
        deleteRuntimeAndUnchangedProps(obj, new SwimlaneChartConfigDefaults())
        return trimObject(obj)
    }

    constructor(obj?: Partial<SwimlaneChartConfigInterface>) {
        super()
        if (obj) this.updateFromObject(obj)
    }
}
