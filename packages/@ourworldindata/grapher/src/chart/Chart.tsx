import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    CaptionedChart,
    StaticCaptionedChart,
} from "../captionedChart/CaptionedChart.js"
import { GrapherState } from "../core/Grapher.js"
import { ChartAreaContent } from "./ChartAreaContent.js"
import { StaticChartWrapper } from "./StaticChartWrapper.js"
import { GrapherVariant } from "@ourworldindata/types"

@observer
export class Chart extends React.Component<{
    manager: GrapherState
}> {
    constructor(props: { manager: GrapherState }) {
        super(props)
        makeObservable(this)
    }

    @computed private get manager(): GrapherState {
        return this.props.manager
    }

    @computed private get isCaptioned(): boolean {
        return this.manager.variant === GrapherVariant.Default
    }

    private renderInteractive(): React.ReactElement {
        return this.isCaptioned ? (
            <CaptionedChart manager={this.manager} />
        ) : (
            <ChartAreaContent
                manager={this.manager}
                bounds={this.manager.chartAreaBounds}
            />
        )
    }

    private renderStatic(): React.ReactElement {
        return this.isCaptioned ? (
            <StaticCaptionedChart manager={this.manager} />
        ) : (
            <StaticChartWrapper
                manager={this.manager}
                bounds={this.manager.chartAreaBounds}
            >
                <ChartAreaContent
                    manager={this.manager}
                    bounds={this.manager.chartAreaBounds}
                />
            </StaticChartWrapper>
        )
    }

    override render(): React.ReactElement {
        return this.manager.isStatic
            ? this.renderStatic()
            : this.renderInteractive()
    }
}
