import React from "react"
import { observable, computed, action, makeObservable } from "mobx";
import { observer } from "mobx-react"
import { ChartEditor } from "./ChartEditor.js"
import { Grapher } from "../grapher/core/Grapher.js"
import { ComparisonLineConfig } from "../grapher/scatterCharts/ComparisonLine.js"
import {
    NumberField,
    Toggle,
    FieldsRow,
    Section,
    BindString,
    TextField,
    Button,
    RadioGroup,
} from "./Forms.js"
import { debounce, isEqual, omit, trimObject } from "../clientUtils/Util.js"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    ColorSchemeDropdown,
    ColorSchemeOption,
} from "./ColorSchemeDropdown.js"
import { EditorColorScaleSection } from "./EditorColorScaleSection.js"
import { ColorSchemeName } from "../grapher/color/ColorConstants.js"
import { TimeBoundValue } from "../clientUtils/TimeBounds.js"
import {
    FacetAxisDomain,
    FacetStrategy,
} from "../grapher/core/GrapherConstants.js"
import Select from "react-select"
import { SortOrder, SortBy, SortConfig } from "../clientUtils/owidTypes.js"
export const ColorSchemeSelector = observer(class ColorSchemeSelector extends React.Component<{ grapher: Grapher }> {
    constructor(props: { grapher: Grapher }) {
        super(props);

        makeObservable(this, {
            onChange: action.bound,
            onInvertColorScheme: action.bound
        });
    }

    onChange(selected: ColorSchemeOption) {
        // The onChange method can return an array of values (when multiple
        // items can be selected) or a single value. Since we are certain that
        // we are not using the multi-option select we can force the type to be
        // a single value.

        this.props.grapher.baseColorScheme = (
            selected.value === "default" ? undefined : selected.value
        ) as ColorSchemeName

        // clear out saved, pre-computed colors so the color scheme change is immediately visible
        this.props.grapher.seriesColorMap?.clear()
    }

    onInvertColorScheme(value: boolean) {
        this.props.grapher.invertColorScheme = value || undefined

        this.props.grapher.seriesColorMap?.clear()
    }

    render() {
        const { grapher } = this.props

        return (
            <React.Fragment>
                <FieldsRow>
                    <div className="form-group">
                        <label>Color scheme</label>
                        <ColorSchemeDropdown
                            value={grapher.baseColorScheme || "default"}
                            onChange={this.onChange}
                            chartType={this.props.grapher.type}
                            invertedColorScheme={!!grapher.invertColorScheme}
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
                        value={!!grapher.invertColorScheme}
                        onValue={this.onInvertColorScheme}
                    />
                </FieldsRow>
            </React.Fragment>
        )
    }
});

interface SortOrderDropdownOption {
    label: string
    value: Omit<SortConfig, "sortOrder">
    display?: { name: string; displayName: string }
}

const SortOrderSection = observer(class SortOrderSection extends React.Component<{ editor: ChartEditor }> {
    constructor(props: { editor: ChartEditor }) {
        super(props);

        makeObservable(this, {
            sortConfig: computed,
            grapher: computed,
            sortOptions: computed,
            onSortByChange: action.bound,
            onSortOrderChange: action.bound
        });
    }

    get sortConfig(): SortConfig {
        return this.grapher._sortConfig
    }

    get grapher() {
        return this.props.editor.grapher
    }

    get sortOptions(): SortOrderDropdownOption[] {
        const { features } = this.props.editor

        let dimensionSortOptions: SortOrderDropdownOption[] = []
        if (features.canSortByColumn) {
            dimensionSortOptions = this.grapher.yColumnsFromDimensions.map(
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

    onSortByChange(selected: SortOrderDropdownOption | null) {
        this.grapher.sortBy = selected?.value.sortBy
        this.grapher.sortColumnSlug = selected?.value.sortColumnSlug
    }

    onSortOrderChange(sortOrder: string) {
        this.grapher.sortOrder = sortOrder as SortOrder
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
});

const FacetSection = observer(class FacetSection extends React.Component<{ editor: ChartEditor }> {
    base: React.RefObject<HTMLDivElement> = React.createRef()

    constructor(props: { editor: ChartEditor }) {
        super(props);

        makeObservable(this, {
            grapher: computed,
            facetOptions: computed,
            facetSelection: computed,
            onFacetSelectionChange: action.bound
        });
    }

    get grapher() {
        return this.props.editor.grapher
    }

    get facetOptions(): Array<{
        label: string
        value?: FacetStrategy
    }> {
        return [{ label: "auto" }].concat(
            this.grapher.availableFacetStrategies.map((s) => {
                return { label: s.toString(), value: s }
            })
        )
    }

    get facetSelection(): { label: string; value?: FacetStrategy } {
        const strategy = this.grapher.selectedFacetStrategy
        if (strategy) {
            return { label: strategy.toString(), value: strategy }
        }

        return { label: "auto" }
    }

    onFacetSelectionChange(
        selected: {
            label: string
            value?: FacetStrategy
        } | null
    ) {
        this.grapher.selectedFacetStrategy = selected?.value
    }

    render() {
        const yAxisConfig = this.props.editor.grapher.yAxis

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
});

const TimelineSection = observer(class TimelineSection extends React.Component<{ editor: ChartEditor }> {
    base: React.RefObject<HTMLDivElement> = React.createRef()

    constructor(props: { editor: ChartEditor }) {
        super(props);

        makeObservable(this, {
            grapher: computed,
            minTime: computed,
            maxTime: computed,
            timelineMinTime: computed,
            timelineMaxTime: computed,
            onMinTime: action.bound,
            onMaxTime: action.bound,
            onTimelineMinTime: action.bound,
            onTimelineMaxTime: action.bound,
            onToggleHideTimeline: action.bound,
            onToggleShowYearLabels: action.bound
        });
    }

    get grapher() {
        return this.props.editor.grapher
    }

    get minTime() {
        return this.grapher.minTime
    }
    get maxTime() {
        return this.grapher.maxTime
    }

    get timelineMinTime() {
        return this.grapher.timelineMinTime
    }
    get timelineMaxTime() {
        return this.grapher.timelineMaxTime
    }

    onMinTime(value: number | undefined) {
        this.grapher.minTime = value ?? TimeBoundValue.negativeInfinity
    }

    onMaxTime(value: number | undefined) {
        this.grapher.maxTime = value ?? TimeBoundValue.positiveInfinity
    }

    onTimelineMinTime(value: number | undefined) {
        this.grapher.timelineMinTime = value
    }

    onTimelineMaxTime(value: number | undefined) {
        this.grapher.timelineMaxTime = value
    }

    onToggleHideTimeline(value: boolean) {
        this.grapher.hideTimeline = value || undefined
    }

    onToggleShowYearLabels(value: boolean) {
        this.grapher.showYearLabels = value || undefined
    }

    render() {
        const { features } = this.props.editor
        const { grapher } = this

        return (
            <Section name="Timeline selection">
                <FieldsRow>
                    {features.timeDomain && (
                        <NumberField
                            label="Selection start"
                            value={this.minTime}
                            onValue={debounce(this.onMinTime)}
                            allowNegative
                        />
                    )}
                    <NumberField
                        label={
                            features.timeDomain
                                ? "Selection end"
                                : "Selected year"
                        }
                        value={this.maxTime}
                        onValue={debounce(this.onMaxTime)}
                        allowNegative
                    />
                </FieldsRow>
                {features.timelineRange && (
                    <FieldsRow>
                        <NumberField
                            label="Timeline min"
                            value={this.timelineMinTime}
                            onValue={debounce(this.onTimelineMinTime)}
                            allowNegative
                        />
                        <NumberField
                            label="Timeline max"
                            value={this.timelineMaxTime}
                            onValue={debounce(this.onTimelineMaxTime)}
                            allowNegative
                        />
                    </FieldsRow>
                )}
                <FieldsRow>
                    <Toggle
                        label="Hide timeline"
                        value={!!grapher.hideTimeline}
                        onValue={this.onToggleHideTimeline}
                    />
                    {features.showYearLabels && (
                        <Toggle
                            label="Always show year labels"
                            value={!!grapher.showYearLabels}
                            onValue={this.onToggleShowYearLabels}
                        />
                    )}
                </FieldsRow>
            </Section>
        )
    }
});

const ComparisonLineSection = observer(
    class ComparisonLineSection extends React.Component<{ editor: ChartEditor }> {
        comparisonLines: ComparisonLineConfig[] = [];

        constructor(props: { editor: ChartEditor }) {
            super(props);

            makeObservable(this, {
                comparisonLines: observable,
                onAddComparisonLine: action.bound,
                onRemoveComparisonLine: action.bound
            });
        }

        onAddComparisonLine() {
            const { grapher } = this.props.editor
            grapher.comparisonLines.push({})
        }

        onRemoveComparisonLine(index: number) {
            const { grapher } = this.props.editor
            grapher.comparisonLines!.splice(index, 1)
        }

        render() {
            const { comparisonLines } = this.props.editor.grapher

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
);

export const EditorCustomizeTab = observer(class EditorCustomizeTab extends React.Component<{
    editor: ChartEditor
}> {
    render() {
        const xAxisConfig = this.props.editor.grapher.xAxis
        const yAxisConfig = this.props.editor.grapher.yAxis

        const { features } = this.props.editor
        const { grapher } = this.props.editor

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
                                        allowDecimal
                                        allowNegative
                                    />
                                    <NumberField
                                        label={`Max`}
                                        value={yAxisConfig.max}
                                        onValue={(value) =>
                                            (yAxisConfig.max = value)
                                        }
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
                            </React.Fragment>
                        )}
                        {features.canCustomizeYAxisLabel && (
                            <BindString
                                label="Label"
                                field="label"
                                store={yAxisConfig}
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
                                        allowDecimal
                                        allowNegative
                                    />
                                    <NumberField
                                        label={`Max`}
                                        value={xAxisConfig.max}
                                        onValue={(value) =>
                                            (xAxisConfig.max = value)
                                        }
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
                            </React.Fragment>
                        )}
                        {features.canCustomizeXAxisLabel && (
                            <BindString
                                label="Label"
                                field="label"
                                store={xAxisConfig}
                            />
                        )}
                    </Section>
                )}
                <TimelineSection editor={this.props.editor} />
                <FacetSection editor={this.props.editor} />
                <Section name="Color scheme">
                    <ColorSchemeSelector grapher={grapher} />
                </Section>
                {features.canSpecifySortOrder && (
                    <SortOrderSection editor={this.props.editor} />
                )}
                {grapher.chartInstanceExceptMap.colorScale && (
                    <EditorColorScaleSection
                        scale={grapher.chartInstanceExceptMap.colorScale}
                        chartType={grapher.type}
                        features={{
                            visualScaling: true,
                            legendDescription: true,
                        }}
                    />
                )}
                {(features.hideLegend || features.entityType) && (
                    <Section name="Legend">
                        <FieldsRow>
                            {features.hideLegend && (
                                <Toggle
                                    label={`Hide legend`}
                                    value={!!grapher.hideLegend}
                                    onValue={(value) =>
                                        (grapher.hideLegend =
                                            value || undefined)
                                    }
                                />
                            )}
                        </FieldsRow>
                        {features.entityType && (
                            <FieldsRow>
                                <BindString
                                    label="Entity name (singular)"
                                    field="entityType"
                                    store={grapher}
                                />
                                <BindString
                                    label="Entity name (plural)"
                                    field="entityTypePlural"
                                    store={grapher}
                                />
                            </FieldsRow>
                        )}
                    </Section>
                )}
                {features.relativeModeToggle && (
                    <Section name="Controls">
                        <FieldsRow>
                            <Toggle
                                label={`Hide relative toggle`}
                                value={!!grapher.hideRelativeToggle}
                                onValue={(value) =>
                                    (grapher.hideRelativeToggle =
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
                                value={!!grapher.hideTotalValueLabel}
                                onValue={(value) =>
                                    (grapher.hideTotalValueLabel =
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
});
