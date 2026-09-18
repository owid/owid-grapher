import { observable, makeObservable } from "mobx"
import {
    SwimlaneChartConfigInterface,
    SwimlaneSegmentLabels,
} from "@ourworldindata/types"
import {
    Persistable,
    updatePersistables,
    objectWithPersistablesToObject,
    deleteRuntimeAndUnchangedProps,
    trimObject,
    NoUndefinedValues,
} from "@ourworldindata/utils"

export const SWIMLANE_CHART_CONFIG_DEFAULTS = {
    segmentLabels: SwimlaneSegmentLabels.CategoryAndTimeRange,
} satisfies Partial<SwimlaneChartConfigInterface>

class SwimlaneChartConfigDefaults {
    segmentLabels: SwimlaneSegmentLabels =
        SWIMLANE_CHART_CONFIG_DEFAULTS.segmentLabels

    constructor() {
        makeObservable(this, {
            segmentLabels: observable.ref,
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
