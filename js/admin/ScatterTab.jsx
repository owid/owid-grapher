import * as d3 from 'd3'
import _ from 'lodash'
import dataflow from '../charts/owid.dataflow'
import React, {Component} from 'react'
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'

@observer
export default class ScatterTab extends Component {
    props: {
        chart: ChartConfig
    }

    @observable timeline = {
        defaultYear: null
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

    render() {
        const {isEnabled, timeline} = this

        return <div id="scatter-tab" class="tab-pane">
            <section>
                <h2>Timeline</h2>
                <p class="form-section-desc">Note that the timeline settings will override any variable settings for target year and tolerance.</p>
                <label class="clickable"><input type="checkbox" value={!!isEnabled} onChange={this.onToggleTimeline}/> Enable timeline</label>
                {isEnabled && <div class="timeline-settings">
                    <label><i class="fa fa-info-circle" data-toggle="tooltip" title="" data-original-title="Specify a range of years from which to pull data. For example, if the map shows 1990 and tolerance is set to 1, then data from 1989 or 1991 will be shown if no data is available for 1990."></i> Tolerance of data:
                        <input name="tolerance" class="form-control" placeholder="Tolerance of data"/>
                    </label> 
                    <label>Default year to show: 
                        <select name="defaultYear">
                            <option value="latest">Latest year</option>
                            <option value="earliest">Earliest year</option>
                        </select>
                    </label>
                </div>}
            </section>        
        </div>
    }
}

/*owid.config.scatter = function(chart) {
    var config = dataflow();

    config.inputs({
        formNode: undefined,
        timeRanges: null,
        defaultYear: 'latest',
        tolerance: null,
        isEnabled: false
    });

    config.flow('tab : formNode', function(formNode) {
        var form = d3.select(formNode);

        if (form.select('.scatter-item').empty()) {
            form.select('.nav-tabs').append('li')
                .attr('class', 'nav-item scatter-item')
                .append('a')
                  .attr('class', 'nav-link')
                  .attr('data-toggle', 'tab')
                  .attr('href', '#scatter-tab')
                  .text('Scatter');
        }

        if (form.select('#scatter-tab').empty()) {
            form.select('.tab-content').append('div')
                .attr('id', 'scatter-tab')
                .attr('class', 'tab-pane');
        }

        var tab = form.select('#scatter-tab');
        tab.selectAll('*').remove();
        return tab;
    });

    config.flow('isEnabledInput, timeRangesInput, toleranceInput, defaultYearInput : tab', function(tab) {
        tab.html(

        );

        // Bind events
        var isEnabledInput = tab.select('[name=isEnabled]');
        isEnabledInput.on('change', function() {
            config.update({ isEnabled: isEnabledInput.property('checked') });
        });

        var timeRangesInput = tab.select('[name=timeRanges]');
        timeRangesInput.on('change', function() {
            try {
                var timeRanges = owid.timeRangesFromString(timeRangesInput.property('value'));
                config.update({ timeRanges: timeRanges });

                timeRangesInput.classed('has-error', false);
            } catch (e) {
                if (e instanceof RangeError)    
                    timeRangesInput.classed('has-error', true);
                else
                    throw e;
            }
        });

        var toleranceInput = tab.select('[name=tolerance]');
        toleranceInput.on('change', function() {
            config.update({ tolerance: toleranceInput.property('value') });
        });

        var defaultYearInput = tab.select('[name=defaultYear]');
        defaultYearInput.on('change', function() {
            config.update({ defaultYear: defaultYearInput.property('value') });
        });

        return [isEnabledInput, timeRangesInput, toleranceInput, defaultYearInput];
    });

    config.flow('tab, isEnabled', function(tab, isEnabled) {
        tab.select('.timeline-settings').classed('hidden', !isEnabled);
    });

    config.flow('isEnabled, isEnabledInput', function(isEnabled, isEnabledInput) {
        isEnabledInput.property('checked', !!isEnabled);
    });

    config.flow('timeRanges, timeRangesInput', function(timeRanges, timeRangesInput) {
        var timeRangeStr = owid.timeRangesToString(timeRanges);
        if (timeRangeStr == timeRangesInput.attr('placeholder'))
            timeRangesInput.property('value', '');
        else
            timeRangesInput.property('value', timeRangeStr);
    });

    config.flow('defaultYear, defaultYearInput', function(defaultYear, defaultYearInput) {
        defaultYearInput.property('value', defaultYear);
    });

    config.flow('tolerance, toleranceInput', function(tolerance, toleranceInput) {
        toleranceInput.property('value', tolerance);
    });

    config.flow('isEnabled, timeRanges, defaultYear, tolerance', function(isEnabled, timeRanges, defaultYear, tolerance) {
        if (!isEnabled)
            chart.model.unset('timeline');
        else {
            var timeline = {};
            if (!_.isEmpty(timeRanges)) timeline.timeRanges = timeRanges;
            if (_.isFinite(tolerance)) timeline.tolerance = parseInt(tolerance);
            timeline.defaultYear = defaultYear;
            chart.model.set('timeline', timeline);
        }
    });

    function update() {
        var timelineConfig = chart.model.get('timeline');
        config.update(_.extend({}, timelineConfig, { isEnabled: !!timelineConfig }));
    }

    chart.model.on('change', update);
    update();
    
    return config;
};*/