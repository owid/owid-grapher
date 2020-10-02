import { DualAxis } from "grapher/axis/Axis"
import { Color, SeriesName, Time } from "grapher/core/GrapherConstants"

interface StackedAreaPoint {
    x: number
    y: number
    origY?: number
    time: Time
}

export interface StackedAreaSeries {
    seriesName: SeriesName
    color: Color
    points: StackedAreaPoint[]
    isProjection?: boolean
}

export interface AreasProps extends React.SVGAttributes<SVGGElement> {
    dualAxis: DualAxis
    seriesArr: StackedAreaSeries[]
    focusedSeriesNames: SeriesName[]
    onHover: (hoverIndex: number | undefined) => void
}
