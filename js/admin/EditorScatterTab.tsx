import * as React from 'react'
import {extend, debounce} from '../charts/Util'
import {observable, computed, action, toJS} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig, {HighlightToggleConfig} from '../charts/ChartConfig'
import {ComparisonLineConfig} from '../charts/ComparisonLine'
import {Toggle, NumberField, SelectField} from './Forms'

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

    @action.bound onToggleComparisonLine(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.checked)
            this.props.chart.props.comparisonLine = this.comparisonLine
        else
            this.props.chart.props.comparisonLine = undefined
    }

    @action.bound onToggleHighlightToggle(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.checked)
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

        return <div className="tab-pane">
            <section>
                <h2>Timeline</h2>
                <Toggle label="Hide timeline" value={!!chart.props.hideTimeline} onValue={this.onToggleHideTimeline}/>
                <Toggle label="Hide entities without data for full time span (within tolerance)" value={!!chart.props.hideLinesOutsideTolerance} onValue={this.onToggleHideLinesOutsideTolerance}/>
                <NumberField label="Override X axis target year" value={chart.scatter.xOverrideYear} onValue={debounce(this.onXOverrideYear, 300)}/>

                <h2>Filtering</h2>
                <Toggle label="Exclude observations for entities that are not countries" value={!!chart.props.matchingEntitiesOnly} onValue={action((value: boolean) => chart.props.matchingEntitiesOnly = value||undefined)}/>
                <SelectField label="Exclude individual entities" value={""} onValue={v => v && this.onExcludeEntity(v)} options={excludedEntityChoices}/><br/>
                {chart.scatter.excludedEntities && <div>
                    {chart.scatter.excludedEntities.map(entity => <div className="country-label clickable">
                        <i className="fa fa-remove" onClick={() => this.onUnexcludeEntity(entity)}/>
                        {entity}
                    </div>)}
                </div>}

                <h2>Comparison line</h2>
                <p className="form-section-desc">Overlay a line onto the chart for comparison. Supports basic <a href="https://github.com/silentmatt/expr-eval#expression-syntax">mathematical expressions</a>.</p>
                <label className="clickable"><input type="checkbox" checked={!!hasComparisonLine} onChange={this.onToggleComparisonLine}/> Enable comparison line</label>
                {hasComparisonLine && <div>
                    <label>y= <input type="text" value={comparisonLine.yEquals} placeholder="x" onChange={e => { this.comparisonLine.yEquals = e.target.value; this.save() }}/></label>
                </div>}

                <h2>Highlight toggle</h2>
                <p className="form-section-desc">Allow users to toggle a particular chart selection state to highlight certain entities.</p>
                <label className="clickable"><input type="checkbox" checked={!!hasHighlightToggle} onChange={this.onToggleHighlightToggle}/> Enable highlight toggle</label>
                {hasHighlightToggle && <div>
                    <label>Description <input type="text" value={highlightToggle.description} onInput={e => { this.highlightToggle.description = e.currentTarget.value; this.save() }}/></label>
                    <label>URL Params <input type="text" value={highlightToggle.paramStr} onInput={e => { this.highlightToggle.paramStr = e.currentTarget.value; this.save() }} placeholder="e.g. ?country=AFG"/></label>
                </div>}
            </section>
        </div>
    }
}
