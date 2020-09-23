import { EntityName } from "coreTable/CoreTableConstants"
import { DualAxis } from "grapher/axis/Axis"

export interface StackedAreaValue {
    x: number
    y: number
    origY?: number
    time: number
    isFake?: true
}

export interface StackedAreaSeries {
    entityName: EntityName
    color: string
    values: StackedAreaValue[]
    isProjection?: boolean
}

export interface AreasProps extends React.SVGAttributes<SVGGElement> {
    dualAxis: DualAxis
    data: StackedAreaSeries[]
    focusKeys: EntityName[]
    onHover: (hoverIndex: number | undefined) => void
}
