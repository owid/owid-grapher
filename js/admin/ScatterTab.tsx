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
        $(".nav-tabs").append("<li className='nav-item'><a className='nav-link' href='#scatter-tab' data-toggle='tab'>Scatter</a></li>")
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
        console.log(this.comparisonLine)
        if (this.hasTimeline)
            this.props.chart.timeline = toJS(this.timeline)

        if (this.hasComparisonLine) {
            for (key of this.comparisonLine) {
                if (!_.isNumber(this.comparisonLine[key]))
                    delete this.comparisonLine[key]
            }
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
                <p className="form-section-desc">Overlay a line segment onto the chart for comparison.</p>
                <label className="clickable"><input type="checkbox" checked={!!hasComparisonLine} onChange={this.onToggleComparisonLine}/> Enable comparison line</label>
                {hasComparisonLine && <div>
                    <label>x1 <input type="number" onChange={e => this.setLineCoord('x1', e.target.value)}/></label>
                    <label>y1 <input type="number" onChange={e => this.setLineCoord('y1', e.target.value)}/></label>
                    <label>x2 <input type="number" onChange={e => this.setLineCoord('x2', e.target.value)}/></label>
                    <label>y2 <input type="number" onChange={e => this.setLineCoord('y2', e.target.value)}/></label>
                </div>}
            </section>
        </div>
    }
}
