import { EntityName } from "coreTable/CoreTableConstants"
import { DualAxis } from "grapher/axis/Axis"
import { Color } from "grapher/core/GrapherConstants"
import { PointVector } from "grapher/utils/PointVector"

interface LinePoint {
    x: number
    y: number
}

export interface LineChartMark {
    entityName: EntityName
    color: Color
    isProjection?: boolean
    points: LinePoint[]
}

export interface PlacedLineChartMark extends LineChartMark {
    placedPoints: PointVector[]
}

export interface LinesProps {
    dualAxis: DualAxis
    placedMarks: PlacedLineChartMark[]
    focusedEntities: EntityName[]
    onHover: (hoverX: number | undefined) => void
}
