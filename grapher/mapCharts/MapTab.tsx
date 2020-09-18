import * as React from "react"
import { Bounds } from "grapher/utils/Bounds"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Grapher } from "grapher/core/Grapher"
import { ChartLayout, ChartLayoutView } from "grapher/chart/ChartLayout"
import { GrapherView } from "grapher/core/GrapherView"
import { LoadingOverlay } from "grapher/loadingIndicator/LoadingOverlay"
import { MapChartWithLegend } from "./MapChartWithLegend"

interface MapTabProps {
    grapher: Grapher
    grapherView: GrapherView
    bounds: Bounds
}

@observer
export class MapTab extends React.Component<MapTabProps> {
    @computed get layout() {
        const that = this
        return new ChartLayout({
            get grapher() {
                return that.props.grapher
            },
            get grapherView() {
                return that.props.grapherView
            },
            get bounds() {
                return that.props.bounds
            },
        })
    }

    render() {
        const { grapher } = this.props
        const { layout } = this
        return (
            <ChartLayoutView layout={this.layout}>
                {grapher.isReady ? (
                    <MapChartWithLegend
                        containerElement={
                            this.props.grapherView.base.current ?? undefined
                        }
                        bounds={layout.innerBounds}
                        options={grapher}
                    />
                ) : (
                    <LoadingOverlay bounds={layout.innerBounds} />
                )}
            </ChartLayoutView>
        )
    }
}
