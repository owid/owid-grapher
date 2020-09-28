import { EntityName } from "coreTable/CoreTableConstants"
import { ChartManager } from "grapher/chart/ChartManager"
import { Time, Color } from "grapher/core/GrapherConstants"

export interface DiscreteBarDatum {
    entityName: EntityName
    value: number
    time: Time
    label: string
    color: Color
}

export interface DiscreteBarChartManager extends ChartManager {
    addButtonLabel?: string
    hasFloatingAddButton?: boolean
    showYearLabels?: boolean
}
