import * as React from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { ChartEditor } from "./ChartEditor"
import { ChartConfig } from "charts/ChartConfig"
import { ComparisonLineConfig } from "charts/ComparisonLine"
import {
    NumberField,
    Toggle,
    FieldsRow,
    Section,
    BindAutoString,
    BindString,
    TextField,
    Button
} from "./Forms"
import { debounce } from "charts/Util"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { ColorSchemeDropdown, ColorSchemeOption } from "./ColorSchemeDropdown"
import { EditorColorScaleSection } from "./EditorColorScaleSection"

@observer
class ColorSchemeSelector extends React.Component<{ chart: ChartConfig }> {
    @action.bound onChange(selected: ColorSchemeOption) {
        // The onChange method can return an array of values (when multiple
        // items can be selected) or a single value. Since we are certain that
        // we are not using the multi-option select we can force the type to be
        // a single value.

        this.props.chart.props.baseColorScheme =
            selected.value === "default" ? undefined : selected.value
    }

    @action.bound onInvertColorScheme(value: boolean) {
        this.props.chart.props.invertColorScheme = value || undefined
    }

    render() {
        const { chart } = this.props

        return (
            <React.Fragment>
                <FieldsRow>
                    <div className="form-group">
                        <label>Color scheme</label>
                        <ColorSchemeDropdown
                            value={chart.baseColorScheme || "default"}
                            onChange={this.onChange}
                            invertedColorScheme={
                                !!chart.props.invertColorScheme
                            }
                            additionalOptions={[
                                {
                                    colorScheme: undefined,
                                    gradient: undefined,
                                    label: "Default",
                                    value: "default"
                                }
                            ]}
                        />
                    </div>
                </FieldsRow>
                <FieldsRow>
                    <Toggle
                        label="Invert colors"
                        value={!!chart.props.invertColorScheme}
                        onValue={this.onInvertColorScheme}
                    />
                </FieldsRow>
            </React.Fragment>
        )
    }
}

@observer
class TimelineSection extends React.Component<{ editor: ChartEditor }> {
    base: React.RefObject<HTMLDivElement> = React.createRef()

    @computed get chart() {
        return this.props.editor.chart
    }

    @computed get timelineMinTime() {
        return this.chart.props.timelineMinTime
    }
    @computed get timelineMaxTime() {
        return this.chart.props.timelineMaxTime
    }

    @action.bound setDefaultTimelineStartYear(value: number | undefined) {
        this.chart.props.selectedTimelineStartYear = value
    }

    @action.bound setDefaultTimelineEndYear(value: number | undefined) {
        this.chart.props.selectedTimelineEndYear = value
    }

    @action.bound onTimelineMinTime(value: number | undefined) {
        this.chart.props.timelineMinTime = value
    }

    @action.bound onTimelineMaxTime(value: number | undefined) {
        this.chart.props.timelineMaxTime = value
    }

    @action.bound onToggleHideTimeline(value: boolean) {
        this.chart.props.hideTimeline = value || undefined
    }

    @action.bound onToggleShowYearLabels(value: boolean) {
        this.chart.props.showYearLabels = value || undefined
    }

    render() {
        const { features } = this.props.editor
        const { chart } = this

        return (
            <Section name="Timeline selection">
                <FieldsRow>
                    {features.timeDomain && (
                        <NumberField
                            label="Selection start"
                            value={chart.props.selectedTimelineStartYear}
                            onValue={debounce(this.setDefaultTimelineStartYear)}
                            allowNegative
                        />
                    )}
                    <NumberField
                        label={
                            features.timeDomain
                                ? "Selection end"
                                : "Selected year"
                        }
                        value={chart.props.selectedTimelineEndYear}
                        onValue={debounce(this.setDefaultTimelineEndYear)}
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
                        value={!!chart.props.hideTimeline}
                        onValue={this.onToggleHideTimeline}
                    />
                    {features.showYearLabels && (
                        <Toggle
                            label="Always show year labels"
                            value={!!chart.props.showYearLabels}
                            onValue={this.onToggleShowYearLabels}
                        />
                    )}
                </FieldsRow>
            </Section>
        )
    }
}

@observer
class ComparisonLineSection extends React.Component<{ editor: ChartEditor }> {
    @observable comparisonLines: ComparisonLineConfig[] = []

    @action.bound onAddComparisonLine() {
        const { chart } = this.props.editor

        if (chart.props.comparisonLines === undefined)
            chart.props.comparisonLines = []

        chart.props.comparisonLines.push({})
    }

    @action.bound onRemoveComparisonLine(index: number) {
        const { chart } = this.props.editor

        chart.props.comparisonLines!.splice(index, 1)

        if (chart.props.comparisonLines!.length === 0)
            chart.props.comparisonLines = undefined
    }

    render() {
        const { comparisonLines } = this.props.editor.chart

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
export class EditorCustomizeTab extends React.Component<{
    editor: ChartEditor
}> {
    @computed get xAxis() {
        return this.props.editor.chart.xAxis.props
    }
    @computed get yAxis() {
        return this.props.editor.chart.yAxis.props
    }

    render() {
        const { xAxis, yAxis } = this
        const { features } = this.props.editor
        const { chart } = this.props.editor

        return (
            <div>
                {features.canCustomizeYAxis && (
                    <Section name="Y Axis">
                        {features.canCustomizeYAxisScale && (
                            <React.Fragment>
                                <FieldsRow>
                                    <NumberField
                                        label={`Min`}
                                        value={yAxis.min}
                                        onValue={value => (yAxis.min = value)}
                                        allowDecimal
                                        allowNegative
                                    />
                                    <NumberField
                                        label={`Max`}
                                        value={yAxis.max}
                                        onValue={value => (yAxis.max = value)}
                                        allowDecimal
                                        allowNegative
                                    />
                                </FieldsRow>
                                {features.canRemovePointsOutsideAxisDomain && (
                                    <FieldsRow>
                                        <Toggle
                                            label={`Remove points outside domain`}
                                            value={
                                                yAxis.removePointsOutsideDomain ||
                                                false
                                            }
                                            onValue={value =>
                                                (yAxis.removePointsOutsideDomain =
                                                    value || undefined)
                                            }
                                        />
                                    </FieldsRow>
                                )}
                                <FieldsRow>
                                    <Toggle
                                        label={`Enable log/linear selector`}
                                        value={
                                            yAxis.canChangeScaleType || false
                                        }
                                        onValue={value =>
                                            (yAxis.canChangeScaleType =
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
                                store={yAxis}
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
                                        value={xAxis.min}
                                        onValue={value => (xAxis.min = value)}
                                        allowDecimal
                                        allowNegative
                                    />
                                    <NumberField
                                        label={`Max`}
                                        value={xAxis.max}
                                        onValue={value => (xAxis.max = value)}
                                        allowDecimal
                                        allowNegative
                                    />
                                </FieldsRow>
                                {features.canRemovePointsOutsideAxisDomain && (
                                    <FieldsRow>
                                        <Toggle
                                            label={`Remove points outside domain`}
                                            value={
                                                xAxis.removePointsOutsideDomain ||
                                                false
                                            }
                                            onValue={value =>
                                                (xAxis.removePointsOutsideDomain =
                                                    value || undefined)
                                            }
                                        />
                                    </FieldsRow>
                                )}
                                <FieldsRow>
                                    <Toggle
                                        label={`Enable log/linear selector`}
                                        value={
                                            xAxis.canChangeScaleType || false
                                        }
                                        onValue={value =>
                                            (xAxis.canChangeScaleType =
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
                                store={xAxis}
                            />
                        )}
                    </Section>
                )}
                <TimelineSection editor={this.props.editor} />
                <Section name="Color scheme">
                    <ColorSchemeSelector chart={chart} />
                </Section>
                {chart.activeTransform.colorScale && (
                    <EditorColorScaleSection
                        scale={chart.activeTransform.colorScale}
                        features={{
                            visualScaling: false,
                            legendDescription:
                                chart.isScatter ||
                                chart.isSlopeChart ||
                                chart.isStackedBar
                        }}
                    />
                )}
                {(features.hideLegend || features.entityType) && (
                    <Section name="Legend">
                        <FieldsRow>
                            {features.hideLegend && (
                                <Toggle
                                    label={`Hide legend`}
                                    value={!!chart.hideLegend}
                                    onValue={value =>
                                        (chart.props.hideLegend =
                                            value || undefined)
                                    }
                                />
                            )}
                        </FieldsRow>
                        {features.entityType && (
                            <BindAutoString
                                label="Entity name"
                                field="entityType"
                                store={chart.props}
                                auto="country"
                            />
                        )}
                    </Section>
                )}
                {features.relativeModeToggle && (
                    <Section name="Controls">
                        <FieldsRow>
                            <Toggle
                                label={`Hide relative toggle`}
                                value={!!chart.props.hideRelativeToggle}
                                onValue={value =>
                                    (chart.props.hideRelativeToggle =
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
