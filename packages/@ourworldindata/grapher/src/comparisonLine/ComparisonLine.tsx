import React from "react"
import { observer } from "mobx-react"
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

@observer
export class ComparisonLine<
    LineConfig extends ComparisonLineConfig,
> extends React.Component<ComparisonLineProps<LineConfig>> {
    render() {
        if (isVerticalComparisonLineProps(this.props)) {
            return <VerticalComparisonLine {...this.props} />
        } else {
            return <CustomComparisonLine {...this.props} />
        }
    }
}

function isVerticalComparisonLineProps(
    props: ComparisonLineProps<ComparisonLineConfig>
): props is ComparisonLineProps<VerticalComparisonLineConfig> {
    return isValidVerticalComparisonLineConfig(props.comparisonLine)
}
