import * as d3 from 'd3'
import _ from 'lodash'
import dataflow from '../charts/owid.dataflow'
import React, {Component} from 'react'
import {observable, computed, action, toJS} from 'mobx'
import {observer} from 'mobx-react'

@observer
export default class ScatterTab extends Component {
    props: {
        chart: ChartConfig
    }

    @observable timeline = {
        defaultYear: 'latest'
    }

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

    @action.bound onTolerance(e) {
        const tolerance = parseInt(e.target.value)
        if (_.isFinite(tolerance)) {
            this.timeline.tolerance = tolerance
            this.save()
        }
    }

    @action.bound onDefaultYear(e) {
        this.timeline.defaultYear = e.target.value
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
                <p class="form-section-desc">Note that the timeline settings will override any variable settings for target year and tolerance.</p>
                <label class="clickable"><input type="checkbox" checked={!!isEnabled} onChange={this.onToggleTimeline}/> Enable timeline</label>
                {isEnabled && <div class="timeline-settings">
                    <label><i class="fa fa-info-circle" data-toggle="tooltip" title="Specify a range of years from which to pull data. For example, if the chart shows 1990 and tolerance is set to 1, then data from 1989 or 1991 will be shown if no data is available for 1990."></i> Tolerance of data:
                        <input name="tolerance" class="form-control" placeholder="Tolerance of data" onChange={this.onTolerance}/>
                    </label>
                    <label>Default year to show:
                        <select name="defaultYear" onChange={this.onDefaultYear} value={timeline.defaultYear}>
                            <option value="latest">Latest year</option>
                            <option value="earliest">Earliest year</option>
                        </select>
                    </label>
                </div>}
            </section>
        </div>
    }
}
