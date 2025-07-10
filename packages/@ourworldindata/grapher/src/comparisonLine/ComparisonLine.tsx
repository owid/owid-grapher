import { DualAxis } from "../axis/Axis"
import {
    Color,
    ComparisonLineConfig,
    VerticalComparisonLineConfig,
} from "@ourworldindata/types"
import { VerticalComparisonLine } from "./VerticalComparisonLine"
import { CustomComparisonLine } from "./CustomComparisonLine"
import { isValidVerticalComparisonLineConfig } from "./ComparisonLineHelpers"

export interface ComparisonLineProps<LineConfig extends ComparisonLineConfig> {
    dualAxis: DualAxis
    comparisonLine: LineConfig
    backgroundColor?: Color
}

export const ComparisonLine = <LineConfig extends ComparisonLineConfig>(
    props: ComparisonLineProps<LineConfig>
) => {
    if (isVerticalComparisonLineProps(props)) {
        return <VerticalComparisonLine {...props} />
    } else {
        return <CustomComparisonLine {...props} />
    }
}

function isVerticalComparisonLineProps(
    props: ComparisonLineProps<ComparisonLineConfig>
): props is ComparisonLineProps<VerticalComparisonLineConfig> {
    return isValidVerticalComparisonLineConfig(props.comparisonLine)
}
