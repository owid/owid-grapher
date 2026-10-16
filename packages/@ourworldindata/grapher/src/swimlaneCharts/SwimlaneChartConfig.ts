import { observable, makeObservable } from "mobx"
import {
    SwimlaneChartConfigInterface,
    SwimlaneSegmentLabelMode,
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
    segmentLabelMode: SwimlaneSegmentLabelMode.CategoryAndTimeRange,
} satisfies Partial<SwimlaneChartConfigInterface>

class SwimlaneChartConfigDefaults {
    segmentLabelMode: SwimlaneSegmentLabelMode =
        SWIMLANE_CHART_CONFIG_DEFAULTS.segmentLabelMode

    constructor() {
        makeObservable(this, {
            segmentLabelMode: observable.ref,
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
