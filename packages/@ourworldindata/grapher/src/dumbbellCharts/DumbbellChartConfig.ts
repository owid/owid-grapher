import { observable, makeObservable } from "mobx"
import {
    DumbbellChartConfigInterface,
    DumbbellConnectorStyle,
    DumbbellTrendColorMap,
    DumbbellValueLabelMode,
} from "@ourworldindata/types"
import {
    Persistable,
    updatePersistables,
    objectWithPersistablesToObject,
    deleteRuntimeAndUnchangedProps,
    trimObject,
    NoUndefinedValues,
} from "@ourworldindata/utils"

export const DUMBBELL_CHART_CONFIG_DEFAULTS = {
    connectorStyle: DumbbellConnectorStyle.Arrow,
    valueLabelMode: DumbbellValueLabelMode.Absolute,
} satisfies Partial<DumbbellChartConfigInterface>

class DumbbellChartConfigDefaults {
    connectorStyle: DumbbellConnectorStyle =
        DUMBBELL_CHART_CONFIG_DEFAULTS.connectorStyle
    valueLabelMode: DumbbellValueLabelMode =
        DUMBBELL_CHART_CONFIG_DEFAULTS.valueLabelMode
    trendColorMap: DumbbellTrendColorMap = {}

    constructor() {
        makeObservable(this, {
            connectorStyle: observable.ref,
            valueLabelMode: observable.ref,
            trendColorMap: observable.ref,
        })
    }
}

export class DumbbellChartConfig
    extends DumbbellChartConfigDefaults
    implements Persistable
{
    updateFromObject(obj: Partial<DumbbellChartConfigInterface>): void {
        updatePersistables(this, obj)
    }

    toObject(): NoUndefinedValues<DumbbellChartConfigInterface> {
        const obj = objectWithPersistablesToObject(
            this
        ) as DumbbellChartConfigInterface
        deleteRuntimeAndUnchangedProps(obj, new DumbbellChartConfigDefaults())
        return trimObject(obj)
    }

    constructor(obj?: Partial<DumbbellChartConfigInterface>) {
        super()
        if (obj) this.updateFromObject(obj)
    }
}
