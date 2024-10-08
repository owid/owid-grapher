import React from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { ChartDimension } from "@ourworldindata/grapher"
import { OwidVariableRoundingMode } from "@ourworldindata/types"
import { copyToClipboard, startCase } from "@ourworldindata/utils"
import { DimensionErrorMessage } from "./ChartEditorTypes.js"
import {
    Toggle,
    BindAutoString,
    BindAutoFloat,
    ColorBox,
    SelectField,
    TextAreaField,
} from "./Forms.js"
import { Link } from "./Link.js"
import {
    faChevronDown,
    faChevronUp,
    faRightLeft,
    faTimes,
    faArrowsAltV,
    faCopy,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { OwidTable } from "@ourworldindata/core-table"
import { AbstractChartEditor } from "./AbstractChartEditor.js"

@observer
export class DimensionCard<
    Editor extends AbstractChartEditor,
> extends React.Component<{
    dimension: ChartDimension
    editor: Editor
    isDndEnabled?: boolean
    onChange: (dimension: ChartDimension) => void
    onEdit?: () => void
    onRemove?: () => void
    errorMessage?: DimensionErrorMessage
}> {
    @observable.ref isExpanded: boolean = false

    @computed get table(): OwidTable {
        return this.props.editor.grapher.table
    }

    @action.bound onToggleExpand() {
        this.isExpanded = !this.isExpanded
    }

    @action.bound onIsProjection(value: boolean) {
        this.props.dimension.display.isProjection = value
        this.onChange()
    }

    @action.bound onColor(color: string | undefined) {
        this.props.dimension.display.color = color
        this.onChange()
    }

    @computed get color() {
        return this.props.dimension.column.def.color
    }

    @computed get roundingMode(): OwidVariableRoundingMode {
        return (
            this.props.dimension.display.roundingMode ??
            OwidVariableRoundingMode.decimalPlaces
        )
    }

    private get tableDisplaySettings() {
        const { tableDisplay = {} } = this.props.dimension.display
        return (
            <React.Fragment>
                <hr className="ui divider" />
                Table:
                <Toggle
                    label="Hide absolute change column"
                    value={!!tableDisplay.hideAbsoluteChange}
                    onValue={(value) => {
                        if (!this.props.dimension.display.tableDisplay) {
                            this.props.dimension.display.tableDisplay = {}
                        }
                        tableDisplay.hideAbsoluteChange = value
                        this.onChange()
                    }}
                />
                <Toggle
                    label="Hide relative change column"
                    value={!!tableDisplay.hideRelativeChange}
                    onValue={(value) => {
                        if (!this.props.dimension.display.tableDisplay) {
                            this.props.dimension.display.tableDisplay = {}
                        }
                        tableDisplay.hideRelativeChange = value
                        this.onChange()
                    }}
                />
                <hr className="ui divider" />
            </React.Fragment>
        )
    }

    @action.bound onChange() {
        this.props.onChange(this.props.dimension)
    }

    render() {
        const { dimension, editor, isDndEnabled } = this.props
        const { grapher } = editor
        const { column } = dimension

        return (
            <div className="DimensionCard list-group-item">
                <header>
                    <div>
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
                        {isDndEnabled && (
                            <FontAwesomeIcon icon={faArrowsAltV} />
                        )}
                        <ColorBox
                            color={this.color}
                            onColor={this.onColor}
                            showLineChartColors={grapher.isLineChart}
                        />
                    </div>
                    <Link
                        to={`/variables/${dimension.variableId}`}
                        className="dimensionLink"
                        target="_blank"
                    >
                        {column.name}
                    </Link>
                    <div>
                        {this.props.onEdit && (
                            <div
                                className="clickable"
                                onClick={this.props.onEdit}
                            >
                                <FontAwesomeIcon icon={faRightLeft} />
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
                        <TextAreaField
                            label="Catalog path"
                            value={column.def.catalogPath ?? "(none)"}
                            disabled
                            rows={undefined}
                            buttonContent={<FontAwesomeIcon icon={faCopy} />}
                            onButtonClick={async () => {
                                if (column.def.catalogPath)
                                    await copyToClipboard(
                                        column.def.catalogPath
                                    )
                            }}
                            buttonDisabled={!column.def.catalogPath}
                        />
                        <BindAutoString
                            label="Display name"
                            field="name"
                            store={dimension.display}
                            auto={column.displayName}
                            onBlur={this.onChange}
                            errorMessage={this.props.errorMessage?.displayName}
                        />
                        <BindAutoString
                            label="Unit of measurement"
                            field="unit"
                            store={dimension.display}
                            auto={column.unit ?? ""}
                            onBlur={this.onChange}
                        />
                        <BindAutoString
                            label="Short (axis) unit"
                            field="shortUnit"
                            store={dimension.display}
                            auto={column.shortUnit ?? ""}
                            onBlur={this.onChange}
                        />
                        <SelectField
                            label="Rounding mode"
                            value={dimension.display.roundingMode}
                            onValue={(value) => {
                                const roundingMode =
                                    value as OwidVariableRoundingMode
                                this.props.dimension.display.roundingMode =
                                    roundingMode !==
                                    OwidVariableRoundingMode.decimalPlaces
                                        ? roundingMode
                                        : undefined

                                this.onChange()
                            }}
                            options={Object.keys(OwidVariableRoundingMode).map(
                                (key) => ({
                                    value: key,
                                    label: startCase(key),
                                })
                            )}
                        />
                        {this.roundingMode ===
                            OwidVariableRoundingMode.significantFigures && (
                            <BindAutoFloat
                                label="Number of significant figures"
                                field="numSignificantFigures"
                                store={dimension.display}
                                auto={column.numSignificantFigures}
                                onBlur={this.onChange}
                            />
                        )}
                        <BindAutoFloat
                            label="Number of decimal places"
                            field="numDecimalPlaces"
                            store={dimension.display}
                            auto={column.numDecimalPlaces}
                            onBlur={this.onChange}
                            helpText={
                                this.roundingMode ===
                                OwidVariableRoundingMode.significantFigures
                                    ? "Used in Grapher's table where values are always rounded to a fixed number of decimal places"
                                    : undefined
                            }
                        />
                        <BindAutoFloat
                            label="Unit conversion factor"
                            field="conversionFactor"
                            store={dimension.display}
                            auto={column.unitConversionFactor}
                            helpText={`Multiply all values by this amount`}
                            onBlur={this.onChange}
                        />
                        {this.tableDisplaySettings}
                        <BindAutoFloat
                            field="tolerance"
                            store={dimension.display}
                            auto={column.tolerance}
                            onBlur={this.onChange}
                        />
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
            </div>
        )
    }
}
