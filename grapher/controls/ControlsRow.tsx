import React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import {
    FilterSmallCountriesToggle,
    HighlightToggle,
    AbsRelToggle,
    ZoomToggle,
} from "./Controls"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons/faPencilAlt"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faExchangeAlt } from "@fortawesome/free-solid-svg-icons/faExchangeAlt"
import { Grapher } from "grapher/core/Grapher"
import { CollapsibleList } from "./CollapsibleList/CollapsibleList"
import { ScaleSelector } from "./ScaleSelector"

@observer
export class ControlsRow extends React.Component<{
    grapher: Grapher
}> {
    static readonly height = 45

    @action.bound private onDataSelect() {
        this.grapher.isSelectingData = true
    }

    @computed private get grapher() {
        return this.props.grapher
    }

    @computed private get controlsToRender() {
        const { grapher } = this
        const controls: JSX.Element[] = []

        if (grapher.tab === "chart") {
            const yAxis =
                (grapher.isStackedArea && grapher.stackedAreaTransform.yAxis) ||
                (grapher.isStackedBar && grapher.stackedBarTransform.yAxis) ||
                (grapher.isLineChart && grapher.lineChartTransform.yAxis) ||
                ((grapher.isScatter || grapher.isTimeScatter) &&
                    grapher.scatterTransform.yAxis)

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
                        onClick={this.onDataSelect}
                        key="grapher-select-entities"
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
                        key="grapher-change-entities"
                        data-track-note="grapher-change-entity"
                    >
                        <FontAwesomeIcon icon={faExchangeAlt} /> Change{" "}
                        {grapher.entityType}
                    </button>
                )

            grapher.isScatter &&
                grapher.hasSelection &&
                controls.push(<ZoomToggle key="ZoomToggle" grapher={grapher} />)

            grapher.isScatter &&
                grapher.highlightToggle &&
                controls.push(
                    <HighlightToggle
                        key="highlight-toggle"
                        grapher={grapher}
                        highlightToggle={grapher.highlightToggle}
                    />
                )

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

    render() {
        return this.grapher.isReady && this.controlsToRender.length ? (
            <div className="controlsRow">
                <CollapsibleList rendo={this.controlsToRender}>
                    {this.controlsToRender}
                </CollapsibleList>
            </div>
        ) : null
    }
}
