import * as React from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { ChartDimension } from "grapher/chart/ChartDimension"
import { ChartEditor } from "./ChartEditor"
import {
    Toggle,
    EditableListItem,
    BindAutoString,
    BindAutoFloat,
} from "./Forms"
import { Link } from "./Link"
import { faChevronDown } from "@fortawesome/free-solid-svg-icons/faChevronDown"
import { faChevronUp } from "@fortawesome/free-solid-svg-icons/faChevronUp"
import { faExchangeAlt } from "@fortawesome/free-solid-svg-icons/faExchangeAlt"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { DimensionProperty } from "grapher/core/GrapherConstants"

@observer
export class DimensionCard extends React.Component<{
    dimension: ChartDimension
    editor: ChartEditor
    onEdit?: () => void
    onRemove?: () => void
}> {
    @observable.ref isExpanded: boolean = false

    @computed get hasExpandedOptions(): boolean {
        return (
            this.props.dimension.property === DimensionProperty.y ||
            this.props.dimension.property === DimensionProperty.x ||
            this.props.dimension.property === DimensionProperty.color
        )
    }

    @action.bound onToggleExpand() {
        this.isExpanded = !this.isExpanded
    }

    @action.bound onIsProjection(value: boolean) {
        this.props.dimension.display.isProjection = value
    }

    private get tableDisplaySettings() {
        const { tableDisplay } = this.props.dimension.display
        if (!tableDisplay) return
        return (
            <React.Fragment>
                <hr className="ui divider" />
                Table:
                <Toggle
                    label="Hide absolute change column"
                    value={!!tableDisplay.hideAbsoluteChange}
                    onValue={(value) =>
                        (tableDisplay.hideAbsoluteChange = value)
                    }
                />
                <Toggle
                    label="Hide relative change column"
                    value={!!tableDisplay.hideRelativeChange}
                    onValue={(value) =>
                        (tableDisplay.hideRelativeChange = value)
                    }
                />
                <hr className="ui divider" />
            </React.Fragment>
        )
    }

    @action.bound updateTables() {
        const { grapher } = this.props.editor

        grapher.updateAuthoredVersion({
            dimensions: grapher.filledDimensions.map((dim) => dim.toObject()),
        })

        grapher.rebuildTable()
    }

    render() {
        const { dimension, editor } = this.props
        const { grapher } = editor
        const { column } = dimension

        return (
            <EditableListItem className="DimensionCard">
                <header>
                    <div>
                        {this.hasExpandedOptions && (
                            <span
                                className="clickable"
                                onClick={this.onToggleExpand}
                            >
                                <FontAwesomeIcon
                                    icon={
                                        this.isExpanded
                                            ? faChevronUp
                                            : faChevronDown
                                    }
                                />
                            </span>
                        )}
                    </div>
                    <div>
                        <Link
                            to={`/variables/${dimension.variableId}`}
                            className="dimensionLink"
                            target="_blank"
                        >
                            {column.name}
                        </Link>
                    </div>
                    <div>
                        {this.props.onEdit && (
                            <div
                                className="clickable"
                                onClick={this.props.onEdit}
                            >
                                <FontAwesomeIcon icon={faExchangeAlt} />
                            </div>
                        )}
                        {this.props.onRemove && (
                            <div
                                className="clickable"
                                onClick={this.props.onRemove}
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </div>
                        )}
                    </div>
                </header>
                {this.isExpanded && (
                    <div>
                        <BindAutoString
                            label="Display name"
                            field="name"
                            store={dimension.display}
                            auto={column.displayName}
                            onBlur={this.updateTables}
                        />
                        <BindAutoString
                            label="Unit of measurement"
                            field="unit"
                            store={dimension.display}
                            auto={column.unit}
                            helpText={`Original database unit: ${column.unit}`}
                            onBlur={this.updateTables}
                        />
                        <BindAutoString
                            label="Short (axis) unit"
                            field="shortUnit"
                            store={dimension.display}
                            auto={column.shortUnit}
                            onBlur={this.updateTables}
                        />
                        <BindAutoFloat
                            label="Number of decimal places"
                            field="numDecimalPlaces"
                            store={dimension.display}
                            auto={column.numDecimalPlaces}
                            helpText={`A negative number here will round integers`}
                            onBlur={this.updateTables}
                        />
                        <BindAutoFloat
                            label="Unit conversion factor"
                            field="conversionFactor"
                            store={dimension.display}
                            auto={column.unitConversionFactor}
                            helpText={`Multiply all values by this amount`}
                            onBlur={this.updateTables}
                        />
                        {this.tableDisplaySettings}
                        {(grapher.isScatter ||
                            grapher.isDiscreteBar ||
                            grapher.isLineChart) && (
                            <BindAutoFloat
                                field="tolerance"
                                store={dimension.display}
                                auto={column.tolerance}
                                onBlur={this.updateTables}
                            />
                        )}
                        {grapher.isLineChart && (
                            <Toggle
                                label="Is projection"
                                value={column.isProjection}
                                onValue={this.onIsProjection}
                            />
                        )}
                        <hr className="ui divider" />
                    </div>
                )}
            </EditableListItem>
        )
    }
}
