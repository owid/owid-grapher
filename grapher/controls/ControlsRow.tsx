import React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import {
    Controls,
    FilterSmallCountriesToggle,
    HighlightToggle,
    AbsRelToggle,
    ZoomToggle
} from "./Controls"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons/faPencilAlt"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faExchangeAlt } from "@fortawesome/free-solid-svg-icons/faExchangeAlt"

@observer
export class ControlsRow extends React.Component<{
    controls: Controls
}> {
    @action.bound onDataSelect() {
        this.chart.isSelectingData = true
    }

    @computed get chart() {
        return this.props.controls.props.chart
    }

    @computed get controlsToRender() {
        const chart = this.chart
        const controls: JSX.Element[] = []

        if (chart.tab === "chart") {
            chart.canAddData &&
                !chart.hasFloatingAddButton &&
                !chart.hideEntityControls &&
                controls.push(
                    <button
                        type="button"
                        onClick={this.onDataSelect}
                        data-track-note="chart-select-entities"
                    >
                        {chart.isScatter || chart.isSlopeChart ? (
                            <span className="SelectEntitiesButton">
                                <FontAwesomeIcon icon={faPencilAlt} />
                                {`Select ${chart.entityTypePlural}`}
                            </span>
                        ) : (
                            <span>
                                <FontAwesomeIcon icon={faPlus} />{" "}
                                {chart.addButtonLabel}
                            </span>
                        )}
                    </button>
                )

            chart.canChangeEntity &&
                !chart.hideEntityControls &&
                controls.push(
                    <button
                        type="button"
                        onClick={this.onDataSelect}
                        data-track-note="chart-change-entity"
                    >
                        <FontAwesomeIcon icon={faExchangeAlt} /> Change{" "}
                        {chart.entityType}
                    </button>
                )

            chart.isScatter &&
                chart.highlightToggle &&
                controls.push(
                    <HighlightToggle
                        chart={chart}
                        highlightToggle={chart.highlightToggle}
                    />
                )

            chart.isStackedArea &&
                chart.canToggleRelativeMode &&
                controls.push(<AbsRelToggle chart={chart} />)

            chart.isScatter &&
                chart.scatterTransform.canToggleRelativeMode &&
                controls.push(<AbsRelToggle chart={chart} />)

            chart.isScatter &&
                chart.hasSelection &&
                controls.push(<ZoomToggle chart={chart.script} />)

            chart.isLineChart &&
                chart.lineChartTransform.canToggleRelativeMode &&
                controls.push(<AbsRelToggle chart={chart} />)
        }

        chart.isScatter &&
            chart.hasCountriesSmallerThanFilterOption &&
            controls.push(<FilterSmallCountriesToggle chart={chart} />)

        return controls
    }

    render() {
        return (
            <div className="controlsRow">
                {this.controlsToRender.map(control => (
                    <span key={control.key} className="control">
                        {control}
                    </span>
                ))}
            </div>
        )
    }
}
