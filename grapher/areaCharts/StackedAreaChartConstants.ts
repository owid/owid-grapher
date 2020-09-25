import { EntityName } from "coreTable/CoreTableConstants"
import { DualAxis } from "grapher/axis/Axis"
import { Color, Time } from "grapher/core/GrapherConstants"

export interface StackedAreaPoint {
    x: number
    y: number
    origY?: number
    time: Time
    isFake?: true
}

export interface StackedAreaSeries {
    entityName: EntityName
    color: Color
    points: StackedAreaPoint[]
    isProjection?: boolean
}

export interface AreasProps extends React.SVGAttributes<SVGGElement> {
    dualAxis: DualAxis
    seriesArr: StackedAreaSeries[]
    focusedEntities: EntityName[]
    onHover: (hoverIndex: number | undefined) => void
}
