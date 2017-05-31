import * as d3 from 'd3'
import _ from 'lodash'
import * as React from 'react'
import {observable, computed, action, toJS} from 'mobx'
import {observer} from 'mobx-react'
import Timeline from '../charts/Timeline'
import ChartConfig from '../charts/ChartConfig'

@observer
export default class ScatterTab extends React.Component<{ chart: ChartConfig }, undefined> {
    @observable timeline = {}

    @computed get isEnabled() {
        return !!this.props.chart.timeline
    }

    constructor(props) {
        super(props)
        this.timeline = props.chart.timeline || this.timeline
    }

    componentDidMount() {
        $(".nav-tabs").append("<li class='nav-item'><a class='nav-link' href='#scatter-tab' data-toggle='tab'>Scatter</a></li>")
    }

    @action.bound onToggleTimeline(e) {
        if (e.target.checked)
            this.props.chart.timeline = this.timeline
        else
            this.props.chart.timeline = null
    }    

    @action.bound onToggleEndsOnly(e) {
        this.timeline.compareEndPointsOnly = !!e.target.checked
        this.save()
    }

    save() {
        if (this.isEnabled)
            this.props.chart.timeline = toJS(this.timeline)
    }

    render() {
        const {isEnabled, timeline} = this

        return <div id="scatter-tab" class="tab-pane">
            <section>
                <h2>Timeline</h2>
                <p class="form-section-desc">Note that the timeline settings will override any variable settings for target year (but not for tolerance).</p>
                <label class="clickable"><input type="checkbox" checked={!!isEnabled} onChange={this.onToggleTimeline}/> Enable timeline</label>
                {isEnabled && <div>
                    <label class="clickable"><input type="checkbox" checked={!!this.timeline.compareEndPointsOnly} onChange={this.onToggleEndsOnly}/> Compare end points only</label>
                </div>}
            </section>
        </div>
    }
}
