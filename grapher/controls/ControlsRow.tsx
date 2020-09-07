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

    render() {
        const { chart } = this
        return (
            <div className="controlsRow">
                {chart.tab === "chart" &&
                    chart.canAddData &&
                    !chart.hasFloatingAddButton &&
                    !chart.hideEntityControls && (
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
                    )}

                {chart.tab === "chart" &&
                    chart.canChangeEntity &&
                    !chart.hideEntityControls && (
                        <button
                            type="button"
                            onClick={this.onDataSelect}
                            data-track-note="chart-change-entity"
                        >
                            <FontAwesomeIcon icon={faExchangeAlt} /> Change{" "}
                            {chart.entityType}
                        </button>
                    )}

                {chart.tab === "chart" &&
                    chart.isScatter &&
                    chart.highlightToggle && (
                        <HighlightToggle
                            chart={chart}
                            highlightToggle={chart.highlightToggle}
                        />
                    )}
                {chart.tab === "chart" &&
                    chart.isStackedArea &&
                    chart.canToggleRelativeMode && (
                        <AbsRelToggle chart={chart} />
                    )}
                {chart.tab === "chart" &&
                    chart.isScatter &&
                    chart.scatterTransform.canToggleRelativeMode && (
                        <AbsRelToggle chart={chart} />
                    )}
                {chart.tab === "chart" &&
                    chart.isScatter &&
                    chart.hasSelection && <ZoomToggle chart={chart.script} />}

                {(chart.tab === "table" || chart.isScatter) &&
                    chart.hasCountriesSmallerThanFilterOption && (
                        <FilterSmallCountriesToggle chart={chart} />
                    )}

                {chart.tab === "chart" &&
                    chart.isLineChart &&
                    chart.lineChartTransform.canToggleRelativeMode && (
                        <AbsRelToggle chart={chart} />
                    )}
            </div>
        )
    }
}
