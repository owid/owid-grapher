import * as React from "react"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { SlopeChart } from "grapher/slopeCharts/SlopeChart"
import { Bounds } from "grapher/utils/Bounds"
import { Grapher } from "grapher/core/Grapher"
import { GrapherView } from "grapher/core/GrapherView"
import { ScatterPlot } from "grapher/scatterCharts/ScatterPlot"
import { LineChart } from "grapher/lineCharts/LineChart"
import { StackedAreaChart } from "grapher/areaCharts/StackedAreaChart"
import { DiscreteBarChart } from "grapher/barCharts/DiscreteBarChart"
import { StackedBarChart } from "grapher/barCharts/StackedBarChart"
import { ChartLayout, ChartLayoutView } from "./ChartLayout"
import { TimeScatter } from "grapher/scatterCharts/TimeScatter"
import { LoadingOverlay } from "grapher/loadingIndicator/LoadingOverlay"
import { faExchangeAlt } from "@fortawesome/free-solid-svg-icons/faExchangeAlt"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons/faPencilAlt"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    ZoomToggle,
    AbsRelToggle,
    HighlightToggle,
    FilterSmallCountriesToggle,
} from "grapher/controls/Controls"
import { ScaleSelector } from "grapher/controls/ScaleSelector"
import { AddEntityButton } from "grapher/controls/AddEntityButton"

@observer
export class ChartTab extends React.Component<{
    grapher: Grapher
    grapherView: GrapherView
    bounds: Bounds
}> {
    @computed get controlsRowControls(): React.ReactElement[] {
        const controls: JSX.Element[] = []
        const { grapher } = this.props

        if (!grapher.isReady) return []
        const onDataSelect = action(() => (grapher.isSelectingData = true))

        if (grapher.tab === "chart") {
            const yAxis =
                (grapher.isStackedArea && grapher.stackedAreaTransform.yAxis) ||
                (grapher.isStackedBar &&
                    !grapher.stackedBarTransform.failMessage &&
                    grapher.stackedBarTransform.yAxis) ||
                (grapher.isLineChart && grapher.lineChartTransform.yAxis) ||
                ((grapher.isScatter || grapher.isTimeScatter) &&
                    grapher.scatterTransform.yAxis) ||
                (grapher.isSlopeChart && grapher.yAxis.toVerticalAxis())

            yAxis &&
                yAxis.scaleTypeOptions.length > 1 &&
                controls.push(
                    <ScaleSelector
                        key="scaleSelector"
                        scaleTypeConfig={yAxis}
                        inline={true}
                    />
                )

            grapher.canAddData &&
                !grapher.hasFloatingAddButton &&
                !grapher.hideEntityControls &&
                controls.push(
                    <button
                        type="button"
                        onClick={() => onDataSelect()}
                        key="grapher-select-entities"
                        data-track-note="grapher-select-entities"
                    >
                        {grapher.isScatter || grapher.isSlopeChart ? (
                            <span className="SelectEntitiesButton">
                                <FontAwesomeIcon icon={faPencilAlt} />
                                {`Select ${grapher.entityTypePlural}`}
                            </span>
                        ) : (
                            <span className="SelectEntitiesButton">
                                <FontAwesomeIcon icon={faPlus} />{" "}
                                {grapher.addButtonLabel}
                            </span>
                        )}
                    </button>
                )

            grapher.canChangeEntity &&
                !grapher.hideEntityControls &&
                controls.push(
                    <button
                        type="button"
                        onClick={() => onDataSelect()}
                        key="grapher-change-entities"
                        data-track-note="grapher-change-entity"
                        className="ChangeEntityButton"
                    >
                        <FontAwesomeIcon icon={faExchangeAlt} /> Change{" "}
                        {grapher.entityType}
                    </button>
                )

            grapher.hasFloatingAddButton &&
                grapher.showAddEntityControls &&
                controls.push(
                    <AddEntityButton key="AddEntityButton" grapher={grapher} />
                )

            grapher.isScatter &&
                grapher.hasSelection &&
                controls.push(<ZoomToggle key="ZoomToggle" grapher={grapher} />)

            const absRelToggle =
                (grapher.isStackedArea && grapher.canToggleRelativeMode) ||
                (grapher.isScatter &&
                    grapher.scatterTransform.canToggleRelativeMode) ||
                (grapher.isLineChart &&
                    grapher.lineChartTransform.canToggleRelativeMode)
            absRelToggle &&
                controls.push(
                    <AbsRelToggle key="AbsRelToggle" grapher={grapher} />
                )

            grapher.isScatter &&
                grapher.highlightToggle &&
                controls.push(
                    <HighlightToggle
                        key="highlight-toggle"
                        grapher={grapher}
                        highlightToggle={grapher.highlightToggle}
                    />
                )
        }

        grapher.isScatter &&
            grapher.hasCountriesSmallerThanFilterOption &&
            controls.push(
                <FilterSmallCountriesToggle
                    key="FilterSmallCountriesToggle"
                    grapher={grapher}
                />
            )

        return controls
    }

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
            get renderControlsRow() {
                return that.controlsRowControls.length > 0
            },
        })
    }

    renderChart() {
        const { grapher } = this.props
        const bounds = this.layout.innerBounds

        if (!grapher.isReady) {
            return <LoadingOverlay bounds={bounds} />
        } else if (grapher.isSlopeChart) {
            return <SlopeChart bounds={bounds.padTop(18)} grapher={grapher} />
        } else if (grapher.isScatter) {
            return (
                <ScatterPlot
                    bounds={bounds.padTop(18).padBottom(15)}
                    grapher={grapher}
                />
            )
        } else if (grapher.isTimeScatter) {
            return (
                <TimeScatter
                    bounds={bounds.padTop(18).padBottom(15)}
                    grapher={grapher}
                />
            )
        } else if (grapher.isLineChart) {
            // Switch to bar chart if a single year is selected
            return grapher.lineChartTransform.isSingleTime ? (
                <DiscreteBarChart
                    bounds={bounds.padTop(18).padBottom(15)}
                    grapher={grapher}
                />
            ) : (
                <LineChart
                    bounds={bounds.padTop(18).padBottom(15)}
                    grapher={grapher}
                />
            )
        } else if (grapher.isStackedArea) {
            return (
                <StackedAreaChart
                    bounds={bounds.padTop(18).padBottom(15)}
                    grapher={grapher}
                />
            )
        } else if (grapher.isDiscreteBar) {
            return (
                <DiscreteBarChart
                    bounds={bounds.padTop(18).padBottom(15)}
                    grapher={grapher}
                />
            )
        } else if (grapher.isStackedBar) {
            return (
                <StackedBarChart
                    bounds={bounds.padTop(18).padBottom(15)}
                    grapher={grapher}
                />
            )
        } else {
            return null
        }
    }

    render() {
        return (
            <ChartLayoutView
                layout={this.layout}
                controlsRowControls={this.controlsRowControls}
            >
                {this.renderChart()}
            </ChartLayoutView>
        )
    }
}
