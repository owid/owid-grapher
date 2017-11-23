import * as React from 'react'
import {extend, debounce} from '../charts/Util'
import {observable, computed, action, toJS} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig, {HighlightToggleConfig} from '../charts/ChartConfig'
import {ComparisonLineConfig} from '../charts/ComparisonLine'
import {Toggle, NumberField, SelectField, TextField, Section} from './Forms'

@observer
export default class EditorScatterTab extends React.Component<{ chart: ChartConfig }> {
    @observable comparisonLine: ComparisonLineConfig = { yEquals: undefined }
    @observable highlightToggle: HighlightToggleConfig = { description: "", paramStr: "" }

    @computed get hasComparisonLine() { return !!this.props.chart.comparisonLine }
    @computed get hasHighlightToggle() { return !!this.props.chart.highlightToggle }

    constructor(props: { chart: ChartConfig }) {
        super(props)
        extend(this.comparisonLine, props.chart.comparisonLine)
        extend(this.highlightToggle, props.chart.highlightToggle)
    }

    @action.bound onToggleHideTimeline(value: boolean) {
        this.props.chart.props.hideTimeline = value||undefined
    }

    @action.bound onToggleHideLinesOutsideTolerance(value: boolean) {
        this.props.chart.props.hideLinesOutsideTolerance = value||undefined
    }

    @action.bound onXOverrideYear(value: number) {
        this.props.chart.scatter.xOverrideYear = value
    }

    @action.bound onToggleComparisonLine(value: boolean) {
        if (value)
            this.props.chart.props.comparisonLine = this.comparisonLine
        else
            this.props.chart.props.comparisonLine = undefined
    }

    @action.bound onToggleHighlightToggle(value: boolean) {
        if (value)
            this.props.chart.props.highlightToggle = this.highlightToggle
        else
            this.props.chart.props.highlightToggle = undefined
    }

    save() {
        if (this.hasComparisonLine)
            this.props.chart.props.comparisonLine = toJS(this.comparisonLine)

        if (this.hasHighlightToggle)
            this.props.chart.props.highlightToggle = toJS(this.highlightToggle)
    }

    @computed get excludedEntityChoices(): string [] {
        return this.props.chart.scatter.entitiesToShow
    }

    @action.bound onExcludeEntity(entity: string) {
        const {chart} = this.props
        if (chart.props.excludedEntities === undefined) {
            chart.props.excludedEntities = []
        }

        const entityId = chart.vardata.entityMetaByKey[entity].id
        if (chart.props.excludedEntities.indexOf(entityId) === -1)
            chart.props.excludedEntities.push(entityId)
    }

    @action.bound onUnexcludeEntity(entity: string) {
        const {chart} = this.props
        if (!chart.props.excludedEntities) return

        const entityId = chart.vardata.entityMetaByKey[entity].id
        chart.props.excludedEntities = chart.props.excludedEntities.filter(e => e !== entityId)
    }

    render() {
        const {hasComparisonLine, hasHighlightToggle, comparisonLine, highlightToggle, excludedEntityChoices} = this
        const {chart} = this.props

        return <div className="EditorScatterTab">
            <Section name="Timeline">
                <Toggle label="Hide timeline" value={!!chart.props.hideTimeline} onValue={this.onToggleHideTimeline}/>
                <Toggle label="Hide entities without data for full time span (within tolerance)" value={!!chart.props.hideLinesOutsideTolerance} onValue={this.onToggleHideLinesOutsideTolerance}/>
                <NumberField label="Override X axis target year" value={chart.scatter.xOverrideYear} onValue={debounce(this.onXOverrideYear, 300)}/>
            </Section>

            <Section name="Filtering">
                <Toggle label="Exclude observations for entities that are not countries" value={!!chart.props.matchingEntitiesOnly} onValue={action((value: boolean) => chart.props.matchingEntitiesOnly = value||undefined)}/>
                <SelectField label="Exclude individual entities" value={""} onValue={v => v && this.onExcludeEntity(v)} options={excludedEntityChoices}/>
                {chart.scatter.excludedEntities && <ul className="excludedEntities">
                    {chart.scatter.excludedEntities.map(entity => <li>
                        <div className="clickable" onClick={() => this.onUnexcludeEntity(entity)}><i className="fa fa-remove"/></div>
                        {entity}
                    </li>)}
                </ul>}
            </Section>

            <Section name="Comparison line">
                <p>Overlay a line onto the chart for comparison. Supports basic <a href="https://github.com/silentmatt/expr-eval#expression-syntax">mathematical expressions</a>.</p>
                <Toggle label="Enable comparison line" value={!!hasComparisonLine} onValue={this.onToggleComparisonLine}/>
                {hasComparisonLine && <TextField label="y=" placeholder="x" value={comparisonLine.yEquals} onValue={action((value: string) => { this.comparisonLine.yEquals = value||undefined; this.save() })}/>}
            </Section>

            <Section name="Highlight toggle">
                <p>Allow users to toggle a particular chart selection state to highlight certain entities.</p>
                <Toggle label="Enable highlight toggle" value={!!hasHighlightToggle} onValue={this.onToggleHighlightToggle}/>
                {hasHighlightToggle && <div>
                    <TextField label="Description" value={highlightToggle.description} onValue={action((value: string) => { this.highlightToggle.description = value; this.save() })}/>
                    <TextField label="URL Params" placeholder="e.g. ?country=AFG" value={highlightToggle.paramStr} onValue={action((value: string) => { this.highlightToggle.paramStr = value; this.save() })}/>
                </div>}
            </Section>
        </div>
    }
}
