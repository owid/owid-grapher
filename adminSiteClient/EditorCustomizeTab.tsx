import * as React from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import {
    ComparisonLineConfig,
    ColorSchemeName,
    FacetAxisDomain,
    FacetStrategy,
    GRAPHER_CHART_TYPES,
} from "@ourworldindata/types"
import { GrapherState } from "@ourworldindata/grapher"
import {
    NumberField,
    Toggle,
    FieldsRow,
    Section,
    BindString,
    TextField,
    Button,
    RadioGroup,
    BindAutoFloatExt,
} from "./Forms.js"
import {
    debounce,
    isEqual,
    omit,
    trimObject,
    TimeBoundValue,
    SortOrder,
    SortBy,
    SortConfig,
    minTimeBoundFromJSONOrNegativeInfinity,
    maxTimeBoundFromJSONOrPositiveInfinity,
} from "@ourworldindata/utils"
import { faPlus, faMinus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    ColorSchemeDropdown,
    ColorSchemeOption,
} from "./ColorSchemeDropdown.js"
import { EditorColorScaleSection } from "./EditorColorScaleSection.js"
import Select from "react-select"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { ErrorMessages } from "./ChartEditorTypes.js"

const debounceOnLeadingEdge = (fn: (...args: any[]) => void) =>
    debounce(fn, 0, { leading: true, trailing: false })

@observer
class TimeField<
    T extends { [field: string]: any },
    K extends Extract<keyof T, string>,
> extends React.Component<{
    field: K
    store: T
    label: string
    defaultValue: number
    parentValue: number
    isInherited: boolean
    allowLinking: boolean
}> {
    private setValue(value: number) {
        this.props.store[this.props.field] = value as any
    }

    @computed get currentValue(): number | undefined {
        return this.props.store[this.props.field]
    }

    @action.bound onChange(value: number | undefined) {
        this.setValue(value ?? this.props.defaultValue)
    }

    @action.bound onBlur() {
        if (this.currentValue === undefined) {
            this.setValue(this.props.defaultValue)
        }
    }

    render() {
        const { label, field, defaultValue } = this.props

        // the reset button resets the value to its default
        const resetButton = {
            onClick: action(() => this.setValue(defaultValue)),
            disabled: this.currentValue === defaultValue,
        }

        return this.props.allowLinking ? (
            <BindAutoFloatExt
                label={label}
                readFn={(store) => store[field]}
                writeFn={(store, newVal) =>
                    (store[this.props.field] = newVal as any)
                }
                auto={this.props.parentValue}
                isAuto={this.props.isInherited}
                store={this.props.store}
                onBlur={this.onBlur}
                resetButton={resetButton}
            />
        ) : (
            <NumberField
                label={label}
                value={this.currentValue}
                // invoke on the leading edge to avoid interference with onBlur
                onValue={debounceOnLeadingEdge(this.onChange)}
                onBlur={this.onBlur}
                allowNegative
                resetButton={resetButton}
            />
        )
    }
}

@observer
export class ColorSchemeSelector extends React.Component<{
    grapherState: GrapherState
    defaultValue?: ColorSchemeName
}> {
    @action.bound onChange(selected: ColorSchemeOption) {
        // The onChange method can return an array of values (when multiple
        // items can be selected) or a single value. Since we are certain that
        // we are not using the multi-option select we can force the type to be
        // a single value.

        this.props.grapherState.baseColorScheme = (
            selected.value === "default" ? undefined : selected.value
        ) as ColorSchemeName

        // clear out saved, pre-computed colors so the color scheme change is immediately visible
        this.props.grapherState.seriesColorMap?.clear()
    }

    @action.bound onBlur() {
        if (this.props.grapherState.baseColorScheme === undefined) {
            this.props.grapherState.baseColorScheme = this.props.defaultValue

            // clear out saved, pre-computed colors so the color scheme change is immediately visible
            this.props.grapherState.seriesColorMap?.clear()
        }
    }

    @action.bound onInvertColorScheme(value: boolean) {
        this.props.grapherState.invertColorScheme = value || undefined

        this.props.grapherState.seriesColorMap?.clear()
    }

    render() {
        const { grapherState } = this.props

        return (
            <React.Fragment>
                <FieldsRow>
                    <div className="form-group">
                        <label>Color scheme</label>
                        <ColorSchemeDropdown
                            value={grapherState.baseColorScheme}
                            onChange={this.onChange}
                            onBlur={this.onBlur}
                            chartType={
                                this.props.grapherState.chartType ??
                                GRAPHER_CHART_TYPES.LineChart
                            }
                            invertedColorScheme={
                                !!grapherState.invertColorScheme
                            }
                            additionalOptions={[
                                {
                                    colorScheme: undefined,
                                    gradient: undefined,
                                    label: "Default",
                                    value: "default",
                                },
                            ]}
                        />
                    </div>
                </FieldsRow>
                <FieldsRow>
                    <Toggle
                        label="Invert colors"
                        value={!!grapherState.invertColorScheme}
                        onValue={this.onInvertColorScheme}
                    />
                </FieldsRow>
            </React.Fragment>
        )
    }
}

interface SortOrderDropdownOption {
    label: string
    value: Omit<SortConfig, "sortOrder">
    display?: { name: string; displayName: string }
}

@observer
class SortOrderSection<
    Editor extends AbstractChartEditor,
> extends React.Component<{ editor: Editor }> {
    @computed get sortConfig(): SortConfig {
        return this.grapherState._sortConfig
    }

    @computed get grapherState() {
        return this.props.editor.grapherState
    }

    @computed get sortOptions(): SortOrderDropdownOption[] {
        const { features } = this.props.editor

        let dimensionSortOptions: SortOrderDropdownOption[] = []
        if (features.canSortByColumn) {
            dimensionSortOptions = this.grapherState.yColumnsFromDimensions.map(
                (column): SortOrderDropdownOption => ({
                    label: column.displayName,
                    display: {
                        name: column.name,
                        displayName: column.displayName,
                    },
                    value: {
                        sortBy: SortBy.column,
                        sortColumnSlug: column.slug,
                    } as SortConfig,
                })
            )
        }

        return [
            { label: "Entity name", value: { sortBy: SortBy.entityName } },
            { label: "Total value", value: { sortBy: SortBy.total } },
            {
                label: "Custom order (use specified entity order)",
                value: { sortBy: SortBy.custom },
            },
            ...dimensionSortOptions,
        ]
    }

    @action.bound onSortByChange(selected: SortOrderDropdownOption | null) {
        this.grapherState.sortBy = selected?.value.sortBy
        this.grapherState.sortColumnSlug = selected?.value.sortColumnSlug
    }

    @action.bound onSortOrderChange(sortOrder: string) {
        this.grapherState.sortOrder = sortOrder as SortOrder
    }

    render() {
        return (
            <Section name="Sort Order">
                <small className="form-text text-muted">
                    For line charts the sort order is only applied when it's
                    collapsed to a bar chart.
                </small>
                <div className="form-group">
                    Sort by
                    <Select
                        options={this.sortOptions}
                        onChange={this.onSortByChange}
                        value={this.sortOptions.find((opt) =>
                            isEqual(
                                opt.value,
                                trimObject(omit(this.sortConfig, "sortOrder"))
                            )
                        )}
                        formatOptionLabel={(opt, { context }) =>
                            opt.display && context === "menu" ? (
                                <span>
                                    {opt.display.displayName}
                                    <br />
                                    <small style={{ opacity: 0.8 }}>
                                        {opt.display.name}
                                    </small>
                                </span>
                            ) : (
                                opt.label
                            )
                        }
                        menuPlacement="auto"
                    />
                </div>
                <div className="form-group">
                    Sort order
                    <RadioGroup
                        options={[
                            { label: "Descending", value: SortOrder.desc },
                            { label: "Ascending", value: SortOrder.asc },
                        ]}
                        value={this.sortConfig.sortOrder}
                        onChange={this.onSortOrderChange}
                    />
                </div>
            </Section>
        )
    }
}

@observer
class FacetSection<Editor extends AbstractChartEditor> extends React.Component<{
    editor: Editor
}> {
    base: React.RefObject<HTMLDivElement> = React.createRef()

    @computed get grapherState() {
        return this.props.editor.grapherState
    }

    @computed get facetOptions(): Array<{
        label: string
        value?: FacetStrategy
    }> {
        return [{ label: "auto" }].concat(
            this.grapherState.availableFacetStrategies.map((s) => {
                return { label: s.toString(), value: s }
            })
        )
    }

    @computed get facetSelection(): { label: string; value?: FacetStrategy } {
        const strategy = this.grapherState.selectedFacetStrategy
        if (strategy) {
            return { label: strategy.toString(), value: strategy }
        }

        return { label: "auto" }
    }

    @action.bound onFacetSelectionChange(
        selected: {
            label: string
            value?: FacetStrategy
        } | null
    ) {
        this.grapherState.selectedFacetStrategy = selected?.value
    }

    render() {
        const yAxisConfig = this.props.editor.grapherState.yAxis

        return (
            <Section name="Faceting">
                <div className="form-group">
                    Faceting strategy
                    <Select
                        options={this.facetOptions}
                        value={this.facetSelection}
                        onChange={this.onFacetSelectionChange}
                    />
                </div>
                <FieldsRow>
                    <Toggle
                        label={`Hide facet control`}
                        value={this.grapherState.hideFacetControl || false}
                        onValue={(value) => {
                            this.grapherState.hideFacetControl =
                                value || undefined
                        }}
                    />
                </FieldsRow>
                <FieldsRow>
                    <Toggle
                        label={`Facets have uniform y-axis`}
                        value={
                            yAxisConfig.facetDomain === FacetAxisDomain.shared
                        }
                        onValue={(value) => {
                            yAxisConfig.facetDomain = value
                                ? FacetAxisDomain.shared
                                : FacetAxisDomain.independent
                        }}
                    />
                </FieldsRow>
            </Section>
        )
    }
}

@observer
class TimelineSection<
    Editor extends AbstractChartEditor,
> extends React.Component<{ editor: Editor }> {
    base: React.RefObject<HTMLDivElement> = React.createRef()

    @computed get grapherState() {
        return this.props.editor.grapherState
    }

    @action.bound onToggleHideTimeline(value: boolean) {
        this.grapherState.hideTimeline = value || undefined
    }

    @action.bound onToggleShowYearLabels(value: boolean) {
        this.grapherState.showYearLabels = value || undefined
    }

    render() {
        const { editor } = this.props
        const { features } = editor
        const { grapherState } = this

        return (
            <Section name="Timeline selection">
                <FieldsRow>
                    {features.timeDomain && (
                        <TimeField
                            store={this.grapherState}
                            field="minTime"
                            label="Selection start"
                            defaultValue={TimeBoundValue.negativeInfinity}
                            parentValue={minTimeBoundFromJSONOrNegativeInfinity(
                                editor.activeParentConfig?.minTime
                            )}
                            isInherited={editor.isPropertyInherited("minTime")}
                            allowLinking={editor.couldPropertyBeInherited(
                                "minTime"
                            )}
                        />
                    )}
                    <TimeField
                        store={this.grapherState}
                        field="maxTime"
                        label={
                            features.timeDomain
                                ? "Selection end"
                                : "Selected year"
                        }
                        defaultValue={TimeBoundValue.positiveInfinity}
                        parentValue={maxTimeBoundFromJSONOrPositiveInfinity(
                            editor.activeParentConfig?.maxTime
                        )}
                        isInherited={editor.isPropertyInherited("maxTime")}
                        allowLinking={editor.couldPropertyBeInherited(
                            "maxTime"
                        )}
                    />
                </FieldsRow>
                {features.timelineRange && (
                    <FieldsRow>
                        <TimeField
                            store={this.grapherState}
                            field="timelineMinTime"
                            label="Timeline min"
                            defaultValue={TimeBoundValue.negativeInfinity}
                            parentValue={minTimeBoundFromJSONOrNegativeInfinity(
                                editor.activeParentConfig?.timelineMinTime
                            )}
                            isInherited={editor.isPropertyInherited(
                                "timelineMinTime"
                            )}
                            allowLinking={editor.couldPropertyBeInherited(
                                "timelineMinTime"
                            )}
                        />
                        <TimeField
                            store={this.grapherState}
                            field="timelineMaxTime"
                            label="Timeline max"
                            defaultValue={TimeBoundValue.positiveInfinity}
                            parentValue={maxTimeBoundFromJSONOrPositiveInfinity(
                                editor.activeParentConfig?.timelineMaxTime
                            )}
                            isInherited={editor.isPropertyInherited(
                                "timelineMaxTime"
                            )}
                            allowLinking={editor.couldPropertyBeInherited(
                                "timelineMaxTime"
                            )}
                        />
                    </FieldsRow>
                )}
                <FieldsRow>
                    <Toggle
                        label="Hide timeline"
                        value={!!grapherState.hideTimeline}
                        onValue={this.onToggleHideTimeline}
                    />
                    {features.showYearLabels && (
                        <Toggle
                            label="Always show year labels"
                            value={!!grapherState.showYearLabels}
                            onValue={this.onToggleShowYearLabels}
                        />
                    )}
                </FieldsRow>
            </Section>
        )
    }
}

@observer
class ComparisonLineSection<
    Editor extends AbstractChartEditor,
> extends React.Component<{ editor: Editor }> {
    @observable comparisonLines: ComparisonLineConfig[] = []

    @action.bound onAddComparisonLine() {
        const { grapherState } = this.props.editor
        if (!grapherState.comparisonLines) grapherState.comparisonLines = []
        grapherState.comparisonLines.push({})
    }

    @action.bound onRemoveComparisonLine(index: number) {
        const { grapherState } = this.props.editor
        if (!grapherState.comparisonLines) grapherState.comparisonLines = []
        grapherState.comparisonLines.splice(index, 1)
    }

    render() {
        const { comparisonLines = [] } = this.props.editor.grapherState

        return (
            <Section name="Comparison line">
                <p>
                    Overlay a line onto the chart for comparison. Supports basic{" "}
                    <a href="https://github.com/silentmatt/expr-eval#expression-syntax">
                        mathematical expressions
                    </a>
                    .
                </p>

                <Button onClick={this.onAddComparisonLine}>
                    <FontAwesomeIcon icon={faPlus} /> Add comparison line
                </Button>
                {comparisonLines.map((comparisonLine, i) => (
                    <div key={i}>
                        {`Line ${i + 1}`}{" "}
                        <Button onClick={() => this.onRemoveComparisonLine(i)}>
                            <FontAwesomeIcon icon={faMinus} />
                        </Button>
                        <TextField
                            label={`y=`}
                            placeholder="x"
                            value={comparisonLine.yEquals}
                            onValue={action((value: string) => {
                                comparisonLine.yEquals = value || undefined
                            })}
                        />
                        <TextField
                            label="Label"
                            value={comparisonLine.label}
                            onValue={action((value: string) => {
                                comparisonLine.label = value || undefined
                            })}
                        />
                    </div>
                ))}
            </Section>
        )
    }
}

@observer
export class EditorCustomizeTab<
    Editor extends AbstractChartEditor,
> extends React.Component<{
    editor: Editor
    errorMessages: ErrorMessages
}> {
    @computed get errorMessages() {
        return this.props.errorMessages
    }

    render() {
        const xAxisConfig = this.props.editor.grapherState.xAxis
        const yAxisConfig = this.props.editor.grapherState.yAxis

        const { features, activeParentConfig } = this.props.editor
        const { grapherState } = this.props.editor

        return (
            <div>
                {features.canCustomizeYAxis && (
                    <Section name="Y Axis">
                        {features.canCustomizeYAxisScale && (
                            <React.Fragment>
                                <FieldsRow>
                                    <NumberField
                                        label={`Min`}
                                        value={yAxisConfig.min}
                                        onValue={(value) =>
                                            (yAxisConfig.min = value)
                                        }
                                        resetButton={{
                                            onClick: () =>
                                                (yAxisConfig.min = Infinity),
                                            disabled:
                                                yAxisConfig.min === Infinity,
                                        }}
                                        allowDecimal
                                        allowNegative
                                    />
                                    <NumberField
                                        label={`Max`}
                                        value={yAxisConfig.max}
                                        onValue={(value) =>
                                            (yAxisConfig.max = value)
                                        }
                                        resetButton={{
                                            onClick: () =>
                                                (yAxisConfig.max = -Infinity),
                                            disabled:
                                                yAxisConfig.max === -Infinity,
                                        }}
                                        allowDecimal
                                        allowNegative
                                    />
                                </FieldsRow>
                                {features.canRemovePointsOutsideAxisDomain && (
                                    <FieldsRow>
                                        <Toggle
                                            label={`Remove points outside domain`}
                                            value={
                                                yAxisConfig.removePointsOutsideDomain ||
                                                false
                                            }
                                            onValue={(value) =>
                                                (yAxisConfig.removePointsOutsideDomain =
                                                    value || undefined)
                                            }
                                        />
                                    </FieldsRow>
                                )}
                                {features.canEnableLogLinearToggle && (
                                    <FieldsRow>
                                        <Toggle
                                            label={`Enable log/linear selector`}
                                            value={
                                                yAxisConfig.canChangeScaleType ||
                                                false
                                            }
                                            onValue={(value) =>
                                                (yAxisConfig.canChangeScaleType =
                                                    value || undefined)
                                            }
                                        />
                                    </FieldsRow>
                                )}
                            </React.Fragment>
                        )}
                        {features.canCustomizeYAxisLabel && (
                            <BindString
                                label="Label"
                                field="label"
                                store={yAxisConfig}
                                errorMessage={this.errorMessages.axisLabelY}
                                onBlur={() => {
                                    if (
                                        yAxisConfig.label === "" &&
                                        activeParentConfig?.yAxis?.label
                                    ) {
                                        yAxisConfig.label =
                                            activeParentConfig.yAxis.label
                                    }
                                }}
                            />
                        )}
                    </Section>
                )}
                {features.canCustomizeXAxis && (
                    <Section name="X Axis">
                        {features.canCustomizeXAxisScale && (
                            <React.Fragment>
                                <FieldsRow>
                                    <NumberField
                                        label={`Min`}
                                        value={xAxisConfig.min}
                                        onValue={(value) =>
                                            (xAxisConfig.min = value)
                                        }
                                        resetButton={{
                                            onClick: () =>
                                                (xAxisConfig.min = undefined),
                                            disabled:
                                                xAxisConfig.min === undefined,
                                        }}
                                        allowDecimal
                                        allowNegative
                                    />
                                    <NumberField
                                        label={`Max`}
                                        value={xAxisConfig.max}
                                        onValue={(value) =>
                                            (xAxisConfig.max = value)
                                        }
                                        resetButton={{
                                            onClick: () =>
                                                (xAxisConfig.max = undefined),
                                            disabled:
                                                xAxisConfig.max === undefined,
                                        }}
                                        allowDecimal
                                        allowNegative
                                    />
                                </FieldsRow>
                                {features.canRemovePointsOutsideAxisDomain && (
                                    <FieldsRow>
                                        <Toggle
                                            label={`Remove points outside domain`}
                                            value={
                                                xAxisConfig.removePointsOutsideDomain ||
                                                false
                                            }
                                            onValue={(value) =>
                                                (xAxisConfig.removePointsOutsideDomain =
                                                    value || undefined)
                                            }
                                        />
                                    </FieldsRow>
                                )}
                                {features.canEnableLogLinearToggle && (
                                    <FieldsRow>
                                        <Toggle
                                            label={`Enable log/linear selector`}
                                            value={
                                                xAxisConfig.canChangeScaleType ||
                                                false
                                            }
                                            onValue={(value) =>
                                                (xAxisConfig.canChangeScaleType =
                                                    value || undefined)
                                            }
                                        />
                                    </FieldsRow>
                                )}
                            </React.Fragment>
                        )}
                        {features.canCustomizeXAxisLabel && (
                            <BindString
                                label="Label"
                                field="label"
                                store={xAxisConfig}
                                errorMessage={this.errorMessages.axisLabelX}
                                onBlur={() => {
                                    if (
                                        xAxisConfig.label === "" &&
                                        activeParentConfig?.xAxis?.label
                                    ) {
                                        xAxisConfig.label =
                                            activeParentConfig.xAxis.label
                                    }
                                }}
                            />
                        )}
                    </Section>
                )}
                <TimelineSection editor={this.props.editor} />
                <FacetSection editor={this.props.editor} />
                <Section name="Color scheme">
                    <ColorSchemeSelector
                        grapherState={grapherState}
                        defaultValue={
                            this.props.editor.activeParentConfig
                                ?.baseColorScheme
                        }
                    />
                </Section>
                {features.canSpecifySortOrder && (
                    <SortOrderSection editor={this.props.editor} />
                )}
                {grapherState.chartInstanceExceptMap.colorScale && (
                    <EditorColorScaleSection
                        scale={grapherState.chartInstanceExceptMap.colorScale}
                        chartType={
                            grapherState.chartType ??
                            GRAPHER_CHART_TYPES.LineChart
                        }
                        showLineChartColors={grapherState.isLineChart}
                        features={{
                            visualScaling: true,
                            legendDescription: true,
                        }}
                    />
                )}
                <Section name="Legend">
                    {features.hideLegend && (
                        <FieldsRow>
                            <Toggle
                                label={`Hide legend`}
                                value={!!grapherState.hideLegend}
                                onValue={(value) =>
                                    (grapherState.hideLegend =
                                        value || undefined)
                                }
                            />
                        </FieldsRow>
                    )}
                    <FieldsRow>
                        <BindString
                            label="Entity name (singular)"
                            field="entityType"
                            store={grapherState}
                        />
                        <BindString
                            label="Entity name (plural)"
                            field="entityTypePlural"
                            store={grapherState}
                        />
                    </FieldsRow>
                    {features.canCustomizeVariableType && (
                        <FieldsRow>
                            <BindString
                                label={
                                    <>
                                        Split by <s>metric</s>
                                    </>
                                }
                                field="facettingLabelByYVariables"
                                store={grapherState}
                                helpText={
                                    "When facetting is active, one option is to split " +
                                    "by entity/country, the other is by metric. This option  " +
                                    'lets you override "metric" with a custom word like ' +
                                    '"products" or "species".'
                                }
                            />
                        </FieldsRow>
                    )}
                </Section>
                {features.relativeModeToggle && (
                    <Section name="Controls">
                        <FieldsRow>
                            <Toggle
                                label={`Hide relative toggle`}
                                value={!!grapherState.hideRelativeToggle}
                                onValue={(value) =>
                                    (grapherState.hideRelativeToggle =
                                        value || false)
                                }
                            />
                        </FieldsRow>
                    </Section>
                )}
                {features.canHideTotalValueLabel && (
                    <Section name="Display">
                        <FieldsRow>
                            <Toggle
                                label={`Hide total value label`}
                                value={!!grapherState.hideTotalValueLabel}
                                onValue={(value) =>
                                    (grapherState.hideTotalValueLabel =
                                        value || false)
                                }
                            />
                        </FieldsRow>
                    </Section>
                )}
                {features.comparisonLine && (
                    <ComparisonLineSection editor={this.props.editor} />
                )}
            </div>
        )
    }
}
