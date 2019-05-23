import * as React from 'react'
import { observable, computed, action } from 'mobx'
import { observer } from 'mobx-react'
import { ChartEditor } from './ChartEditor'
import { ChartConfig } from 'charts/ChartConfig'
import {ComparisonLineConfig} from 'charts/ComparisonLine'
import { AxisConfigProps } from 'charts/AxisConfig'
import { NumberField, SelectField, Toggle, FieldsRow, Section, BindAutoString, BindString, TextField, Button, EditableListItem, ColorBox, EditableList } from './Forms'
import { debounce, keysOf } from 'charts/Util'
import { ColorSchemes, ColorScheme } from 'charts/ColorSchemes'
import { Color } from 'charts/Color'

@observer
class ColorSchemeSelector extends React.Component<{ chart: ChartConfig }> {
    @action.bound onValue(value: string) {
        this.props.chart.props.baseColorScheme = value === 'default' ? undefined : value
    }

    @action.bound onInvertColorScheme(value: boolean) {
        this.props.chart.props.invertColorScheme = value || undefined
    }

    render() {
        const { chart } = this.props

        const availableColorSchemes = keysOf(ColorSchemes)
        const colorSchemeLabels = availableColorSchemes.map(scheme => (ColorSchemes[scheme] as ColorScheme).name)

        return <FieldsRow>
            <SelectField label="Color scheme" value={chart.baseColorScheme || "default"} onValue={this.onValue} options={["default"].concat(availableColorSchemes)} optionLabels={["Default"].concat(colorSchemeLabels)} /><br />
            <Toggle label="Invert colors" value={!!chart.props.invertColorScheme} onValue={this.onInvertColorScheme} />
        </FieldsRow>
    }
}

@observer
class ColorableItem extends React.Component<{ label: string, color: string|undefined, onColor: (color: string|undefined) => void }> {
    @observable.ref isChoosingColor: boolean = false

    render() {
        const {label, color} = this.props

        return <EditableListItem key={label} className="ColorableItem">
            <ColorBox color={color} onColor={this.props.onColor}/>
            <div>
                {label}
            </div>
        </EditableListItem>
    }
}

@observer
class ColorsSection extends React.Component<{ chart: ChartConfig }> {
    @action.bound onColorBy(value: string) {
        this.props.chart.props.colorBy = value === "default" ? undefined : value
    }

    @action.bound assignColor(key: string, color: Color|undefined) {
        const {chart} = this.props
        if (chart.props.customColors === undefined)
            chart.props.customColors = {}

        chart.props.customColors[key] = color
    }

    render() {
        const {chart} = this.props

        const customColors = chart.props.customColors||{}
        const colorables = chart.activeTransform.colorables

        return <Section name="Colors">
            <ColorSchemeSelector chart={chart}/>
            {/*<SelectField label="Color by" value={chart.props.colorBy || "default"} onValue={this.onColorBy} options={["default", "entity", "variable"]} optionLabels={["Default", "Entity", "Variable"]} />*/}
            {colorables && <EditableList>
                {colorables.map(c => <ColorableItem key={c.key} label={c.label} color={customColors[c.key]} onColor={(color: Color|undefined) => this.assignColor(c.key, color)}/>)}
            </EditableList>}
        </Section>
    }
}

@observer
class TimelineSelectionSection extends React.Component<{ editor: ChartEditor }> {
    base: React.RefObject<HTMLDivElement> = React.createRef()

    @computed get chart() { return this.props.editor.chart }

    @computed get minTime() { return this.chart.props.minTime }
    @computed get maxTime() { return this.chart.props.maxTime }

    @action.bound onMinTime(value: number | undefined) {
        this.chart.props.minTime = value
    }

    @action.bound onMaxTime(value: number | undefined) {
        this.chart.props.maxTime = value
    }

    render() {
        const { features } = this.props.editor
        const { chart } = this

        return <Section name="Timeline selection">
            <FieldsRow>
                {features.timeDomain && <NumberField label="Min year" value={chart.props.minTime} onValue={debounce(this.onMinTime)} />}
                <NumberField label={features.timeDomain ? "Max year" : "Target year"} value={chart.props.maxTime} onValue={debounce(this.onMaxTime)} />
            </FieldsRow>
        </Section>
    }
}

@observer
class TimelineRangeSection extends React.Component<{ editor: ChartEditor }> {
    base: React.RefObject<HTMLDivElement> = React.createRef()

    @computed get chart() { return this.props.editor.chart }

    @computed get minTime() { return this.chart.props.timelineMinTime }
    @computed get maxTime() { return this.chart.props.timelineMaxTime }

    @action.bound onMinTime(value: number | undefined) {
        this.chart.props.timelineMinTime = value
    }

    @action.bound onMaxTime(value: number | undefined) {
        this.chart.props.timelineMaxTime = value
    }

    render() {
        return <Section name="Timeline limits">
            <FieldsRow>
                <NumberField label="Min year" value={this.minTime} onValue={debounce(this.onMinTime)} />
                <NumberField label="Max year" value={this.maxTime} onValue={debounce(this.onMaxTime)} />
            </FieldsRow>
        </Section>
    }
}

@observer
class ComparisonLineSection extends React.Component<{ editor: ChartEditor }> {
    @observable comparisonLines: ComparisonLineConfig[] = []

    @action.bound onAddComparisonLine() {
        const {chart} = this.props.editor

        if (chart.props.comparisonLines === undefined)
            chart.props.comparisonLines = []

        chart.props.comparisonLines.push({})
    }

    @action.bound onRemoveComparisonLine(index: number) {
        const {chart} = this.props.editor

        chart.props.comparisonLines!.splice(index, 1)

        if (chart.props.comparisonLines!.length === 0)
            chart.props.comparisonLines = undefined
    }

    render() {
        const {comparisonLines} = this.props.editor.chart

        return <Section name="Comparison line">
            <p>Overlay a line onto the chart for comparison. Supports basic <a href="https://github.com/silentmatt/expr-eval#expression-syntax">mathematical expressions</a>.</p>

            <Button onClick={this.onAddComparisonLine}><i className="fa fa-plus"></i> Add comparison line</Button>
            {comparisonLines.map((comparisonLine, i) => <div key={i}>
                {`Line ${i+1}`} <Button onClick={() => this.onRemoveComparisonLine(i)}><i className="fa fa-remove"></i></Button>
                <TextField label={`y=`} placeholder="x" value={comparisonLine.yEquals} onValue={action((value: string) => { comparisonLine.yEquals = value||undefined })}/>
                <TextField label="Label" value={comparisonLine.label} onValue={action((value: string) => { comparisonLine.label = value||undefined })}/>
            </div>)}
        </Section>
    }
}

@observer
export class EditorCustomizeTab extends React.Component<{ editor: ChartEditor }> {
    @computed get xAxis() { return this.props.editor.chart.xAxis.props }
    @computed get yAxis() { return this.props.editor.chart.yAxis.props }

    renderForAxis(axisName: string, axis: AxisConfigProps) {
        return <div>
        </div>
    }

    render() {
        const { xAxis, yAxis } = this
        const { features } = this.props.editor
        const { chart } = this.props.editor

        return <div>
            {features.customYAxis && <Section name="Y Axis">
                {features.customYAxisScale && <React.Fragment>
                    <FieldsRow>
                        <NumberField label={`Min`} value={yAxis.min} onValue={(value) => yAxis.min = value} />
                        <NumberField label={`Max`} value={yAxis.max} onValue={(value) => yAxis.max = value} />
                    </FieldsRow>
                    <Toggle label={`Enable log/linear selector`} value={yAxis.canChangeScaleType || false} onValue={(value) => yAxis.canChangeScaleType = value || undefined}/>
                </React.Fragment>}
                {features.customYAxisLabel && <BindString label="Label" field="label" store={yAxis}/>}
            </Section>}
            {features.customXAxis && <Section name="X Axis">
                {features.customXAxisScale && <React.Fragment>
                    <FieldsRow>
                        <NumberField label={`Min`} value={xAxis.min} onValue={(value) => xAxis.min = value} />
                        <NumberField label={`Max`} value={xAxis.max} onValue={(value) => xAxis.max = value} />
                    </FieldsRow>
                    <Toggle label={`Enable log/linear selector`} value={xAxis.canChangeScaleType || false} onValue={(value) => xAxis.canChangeScaleType = value || undefined}/>
                </React.Fragment>}
                {features.customXAxisLabel && <BindString label="Label" field="label" store={xAxis}/>}
            </Section>}
            {!chart.isScatter && <TimelineSelectionSection editor={this.props.editor} />}
            {features.timelineRange && <TimelineRangeSection editor={this.props.editor} />}
            <ColorsSection chart={chart}/>
            {(features.hideLegend || features.entityType) && <Section name="Legend">
                <FieldsRow>
                    {features.hideLegend && <Toggle label={`Hide legend`} value={!!chart.hideLegend} onValue={(value) => chart.props.hideLegend = value || undefined} />}
                </FieldsRow>
                {features.entityType && <BindAutoString label="Entity name" field="entityType" store={chart.props} auto="country"/>}
            </Section>}
            {features.relativeModeToggle && <Section name="Controls">
                <FieldsRow>
                    {features.relativeModeToggle && <Toggle label={`Hide relative toggle`} value={!!chart.props.hideRelativeToggle} onValue={value => chart.props.hideRelativeToggle = value || false} />}
                </FieldsRow>
            </Section>}
            {features.comparisonLine && <ComparisonLineSection editor={this.props.editor}/>}
        </div>
    }
}
