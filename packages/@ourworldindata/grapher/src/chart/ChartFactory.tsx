import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { match } from "ts-pattern"
import { GrapherRenderStyle } from "@ourworldindata/utils"
import {
    CaptionedChart,
    StaticCaptionedChart,
} from "../captionedChart/CaptionedChart.js"
import { GrapherState } from "../core/Grapher.js"
import { ChartAreaContent } from "./ChartAreaContent.js"
import { StaticChartWrapper } from "./StaticChartWrapper.js"

@observer
export class ChartFactory extends React.Component<{
    manager: GrapherState
}> {
    @computed private get manager(): GrapherState {
        return this.props.manager
    }

    @computed private get renderStyle(): GrapherRenderStyle {
        return this.props.manager.renderStyle ?? GrapherRenderStyle.Default
    }

    private renderInteractive(): React.ReactElement {
        return match(this.renderStyle)
            .with(GrapherRenderStyle.Default, () => (
                <CaptionedChart manager={this.manager} />
            ))
            .with(GrapherRenderStyle.Thumbnail, () => (
                <ChartAreaContent
                    manager={this.manager}
                    bounds={this.manager.chartAreaBounds}
                />
            ))
            .exhaustive()
    }

    private renderStatic(): React.ReactElement {
        return match(this.renderStyle)
            .with(GrapherRenderStyle.Default, () => (
                <StaticCaptionedChart manager={this.manager} />
            ))
            .with(GrapherRenderStyle.Thumbnail, () => (
                <StaticChartWrapper
                    manager={this.manager}
                    bounds={this.manager.chartAreaBounds}
                >
                    <ChartAreaContent
                        manager={this.manager}
                        bounds={this.manager.chartAreaBounds}
                    />
                </StaticChartWrapper>
            ))
            .exhaustive()
    }

    render(): React.ReactElement {
        return this.manager.isStatic
            ? this.renderStatic()
            : this.renderInteractive()
    }
}
