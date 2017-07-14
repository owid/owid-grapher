import * as d3 from 'd3'
import * as _ from 'lodash'
import * as React from 'react'
import {observable, computed, action, toJS, autorun} from 'mobx'
import {observer} from 'mobx-react'
import Timeline from '../charts/Timeline'
import ChartConfig, {TimelineConfig, HighlightToggleConfig} from '../charts/ChartConfig'
import {ComparisonLineConfig} from '../charts/ComparisonLine'

@observer
export default class EditorScatterTab extends React.Component<{ chart: ChartConfig }, undefined> {
    @observable timeline: TimelineConfig = {}
    @observable comparisonLine: ComparisonLineConfig = {}
    @observable highlightToggle: HighlightToggleConfig = {}

    @computed get hasTimeline() { return !!this.props.chart.timeline }
    @computed get hasComparisonLine() { return !!this.props.chart.comparisonLine }
    @computed get hasHighlightToggle() { return !!this.props.chart.highlightToggle }

    constructor(props: { chart: ChartConfig }) {
        super(props)
        _.extend(this.timeline, props.chart.timeline)
        _.extend(this.comparisonLine, props.chart.comparisonLine)
        _.extend(this.highlightToggle, props.chart.highlightToggle)
    }

    @action.bound onToggleTimeline(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.checked)
            this.props.chart.props.timeline = this.timeline
        else
            this.props.chart.props.timeline = undefined
    }      

    @action.bound onToggleEndsOnly(e: React.ChangeEvent<HTMLInputElement>) {
        this.timeline.compareEndPointsOnly = !!e.target.checked
        this.save()
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
        if (this.hasTimeline)
            this.props.chart.props.timeline = toJS(this.timeline)

        if (this.hasComparisonLine)
            this.props.chart.props.comparisonLine = toJS(this.comparisonLine)

        if (this.hasHighlightToggle)
            this.props.chart.props.highlightToggle = toJS(this.highlightToggle)
    }

    render() {
        const {hasTimeline, hasComparisonLine, hasHighlightToggle, timeline, comparisonLine, highlightToggle} = this
        const {chart} = this.props

        return <div className="tab-pane">
            <section>
                <h2>Timeline</h2>
                <p className="form-section-desc">Note that the timeline settings will override any variable settings for target year (but not for tolerance).</p>
                <label className="clickable"><input type="checkbox" checked={!!hasTimeline} onChange={this.onToggleTimeline}/> Enable timeline</label>
                {hasTimeline && <div>
                    <label className="clickable"><input type="checkbox" checked={!!this.timeline.compareEndPointsOnly} onChange={this.onToggleEndsOnly}/> Compare end points only</label>
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
                    <label>Description <input type="text" value={highlightToggle.description} onBlur={e => { this.highlightToggle.description = e.target.value; this.save() }}/></label>
                    <label>URL Params <input type="text" value={highlightToggle.paramStr} onBlur={e => { this.highlightToggle.paramStr = e.target.value; this.save() }} placeholder="e.g. ?country=AFG"/></label>
                </div>}
                
            </section>
        </div>
    }
}
