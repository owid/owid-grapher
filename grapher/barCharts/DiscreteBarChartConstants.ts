import { EntityName } from "coreTable/CoreTableConstants"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import { Time, Color } from "grapher/core/GrapherConstants"

export interface DiscreteBarDatum {
    entityName: EntityName
    value: number
    time: Time
    label: string
    color: Color
}

export interface DiscreteBarChartOptionsProvider extends ChartOptionsProvider {
    addButtonLabel?: string
    hasFloatingAddButton?: boolean
    showYearLabels?: boolean
}
