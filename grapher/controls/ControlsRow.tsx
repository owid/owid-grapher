import React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import {
    Controls,
    FilterSmallCountriesToggle,
    HighlightToggle,
    AbsRelToggle,
    ZoomToggle,
} from "./Controls"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons/faPencilAlt"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faExchangeAlt } from "@fortawesome/free-solid-svg-icons/faExchangeAlt"
import { ScaleSelector } from "./ScaleSelector"

@observer
export class ControlsRow extends React.Component<{
    controls: Controls
}> {
    static readonly height = 45

    @action.bound onDataSelect() {
        this.grapher.isSelectingData = true
    }

    @computed get grapher() {
        return this.props.controls.props.grapher
    }

    @computed get controlsToRender() {
        const grapher = this.grapher
        const controls: JSX.Element[] = []

        if (grapher.tab === "chart") {
            const yAxis = grapher.activeTransform.yAxis
            yAxis &&
                yAxis.scaleTypeOptions.length > 1 &&
                controls.push(
                    <ScaleSelector scaleTypeConfig={yAxis} inline={true} />
                )

            grapher.canAddData &&
                !grapher.hasFloatingAddButton &&
                !grapher.hideEntityControls &&
                controls.push(
                    <button
                        type="button"
                        onClick={this.onDataSelect}
                        data-track-note="grapher-select-entities"
                    >
                        {grapher.isScatter || grapher.isSlopeChart ? (
                            <span className="SelectEntitiesButton">
                                <FontAwesomeIcon icon={faPencilAlt} />
                                {`Select ${grapher.entityTypePlural}`}
                            </span>
                        ) : (
                            <span>
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
                        onClick={this.onDataSelect}
                        data-track-note="grapher-change-entity"
                    >
                        <FontAwesomeIcon icon={faExchangeAlt} /> Change{" "}
                        {grapher.entityType}
                    </button>
                )

            grapher.isScatter &&
                grapher.highlightToggle &&
                controls.push(
                    <HighlightToggle
                        grapher={grapher}
                        highlightToggle={grapher.highlightToggle}
                    />
                )

            grapher.isStackedArea &&
                grapher.canToggleRelativeMode &&
                controls.push(<AbsRelToggle grapher={grapher} />)

            grapher.isScatter &&
                grapher.scatterTransform.canToggleRelativeMode &&
                controls.push(<AbsRelToggle grapher={grapher} />)

            grapher.isScatter &&
                grapher.hasSelection &&
                controls.push(<ZoomToggle grapher={grapher} />)

            grapher.isLineChart &&
                grapher.lineChartTransform.canToggleRelativeMode &&
                controls.push(<AbsRelToggle grapher={grapher} />)
        }

        grapher.isScatter &&
            grapher.hasCountriesSmallerThanFilterOption &&
            controls.push(<FilterSmallCountriesToggle grapher={grapher} />)

        return controls
    }

    render() {
        return (
            <div className="controlsRow">
                {this.controlsToRender.map((control) => (
                    <span key={control.type} className="control">
                        {control}
                    </span>
                ))}
            </div>
        )
    }
}
