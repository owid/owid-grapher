import { DualAxis } from "../axis/Axis"
import { Color, ComparisonLineConfig } from "@ourworldindata/types"
import { VerticalComparisonLine } from "./VerticalComparisonLine"
import { HorizontalComparisonLine } from "./HorizontalComparisonLine"

interface ComparisonLineProps {
    dualAxis: DualAxis
    comparisonLine: ComparisonLineConfig
    baseFontSize?: number
    backgroundColor?: Color
}

export const ComparisonLine = (props: ComparisonLineProps) => {
    const { comparisonLine } = props
    const isVertical = comparisonLine.xEquals !== undefined

    if (isVertical) {
        return <VerticalComparisonLine {...props} />
    } else {
        return <HorizontalComparisonLine {...props} />
    }
}
