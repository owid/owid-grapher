import * as d3 from 'd3'
import * as _ from 'lodash'
import * as React from 'react'
import {observable, computed, action, toJS, autorun} from 'mobx'
import {observer} from 'mobx-react'
import Timeline from '../charts/Timeline'
import ChartConfig, {TimelineConfig} from '../charts/ChartConfig'
import {ComparisonLineConfig} from '../charts/ComparisonLine'

@observer
export default class ScatterTab extends React.Component<{ chart: ChartConfig }, undefined> {
    @observable timeline: TimelineConfig = {}
    @observable comparisonLine: ComparisonLineConfig = {}
    
    @computed get hasTimeline() { return !!this.props.chart.timeline }
    @computed get hasComparisonLine() { return !!this.props.chart.comparisonLine }

    constructor(props: { chart: ChartConfig }) {
        super(props)
        _.extend(this.timeline, props.chart.timeline)
        _.extend(this.comparisonLine, props.chart.comparisonLine)
    }

    componentDidMount() {
        $(".nav-tabs").append("<li class='nav-item'><a class='nav-link' href='#scatter-tab' data-toggle='tab'>Scatter</a></li>")
    }

    @action.bound onToggleTimeline(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.checked)
            this.props.chart.timeline = this.timeline
        else
            this.props.chart.timeline = null
    }      

    @action.bound onToggleEndsOnly(e: React.ChangeEvent<HTMLInputElement>) {
        this.timeline.compareEndPointsOnly = !!e.target.checked
        this.save()
    }

    @action.bound onToggleComparisonLine(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.checked)
            this.props.chart.comparisonLine = this.comparisonLine
        else
            this.props.chart.comparisonLine = null
    }

    save() {
        if (this.hasTimeline)
            this.props.chart.timeline = toJS(this.timeline)

        if (this.hasComparisonLine) {
            this.props.chart.comparisonLine = toJS(this.comparisonLine)
        }
    }

    setLineCoord(key, value) {
        const num = parseFloat(value)
        if (!_.isFinite(num))
            delete this.comparisonLine[key]
        else
            this.comparisonLine[key] = num
        this.save()
    }

    render() {
        const {hasTimeline, hasComparisonLine, timeline, comparisonLine} = this
        const {chart} = this.props

        return <div id="scatter-tab" className="tab-pane">
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
            </section>
        </div>
    }
}
