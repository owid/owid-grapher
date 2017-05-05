// @flow

import _ from 'lodash'
import 'innersvg'
import Bounds from './Bounds'
import * as d3 from 'd3'
import owid from '../owid'
import dataflow from './owid.dataflow'
import {stripTags} from 'underscore.string'
import React, {Component} from 'react'
import {render} from 'preact'
import Text from './Text'
import Paragraph from './Paragraph'
import {preInstantiate} from './Util'
import {observable, computed} from 'mobx'
import {observer} from 'mobx-react'

@observer
class Logo extends Component {
    props: {
        svg: string,
    }

    @computed get targetHeight() {
        return 40
    }

    @computed get bbox() {
        var div = document.createElement('div');
        div.innerHTML = this.props.svg;
        document.body.appendChild(div)
        const bbox = div.childNodes[0].getBBox()
        document.body.removeChild(div)
        return bbox
    }

    @computed get scale() {
        return this.targetHeight/this.bbox.height;
    }

    @computed get width() { return this.bbox.width*this.scale }
    @computed get height() { return this.bbox.height*this.scale }

    render() {
        const {props, scale} = this
        const svg = props.svg.match(/<svg>(.*)<\/svg>/)[1]||props.svg
        return <g opacity={0.9} transform={`translate(${props.x}, ${props.y}) scale(${scale})`} dangerouslySetInnerHTML={{ __html: svg }}/>
    }
}

@observer
class Header extends Component {
    @computed get logoSVG() {
        return this.props.logosSVG[0]
    }

    @computed get logo() {
        return preInstantiate(<Logo svg={this.logoSVG}/>)
    }

    @computed get title() {
        const {props, logo} = this

        // Try to fit the title into a single line if possible-- but not if it would make the text super small
        let title = null
        let fontSize = 1.25
        while (fontSize > 1.0) {
            title = preInstantiate(<Paragraph width={props.width-logo.width-10} fontSize={fontSize} fill="#555" lineHeight={1}>{props.title.trim()}</Paragraph>)
            if (title.lines.length <= 1)
                break
            fontSize -= 0.05
        }

        return title
    }

    @computed get subtitle() {
        const {props, logo, title} = this

        // If the subtitle is entirely below the logo, we can go underneath it
        const subtitleWidth = title.height > logo.height ? props.width : props.width-logo.width-10

        // Subtitle text must always be smaller than title text.
        var fontSize = 0.65;

        return preInstantiate(<Paragraph width={subtitleWidth} fontSize={fontSize} fill="#666">{props.subtitle.trim()}</Paragraph>)
    }

    @computed get height() {
        return Math.max(this.title.height+this.subtitle.height+2, this.logo.height)
    }

    render() {
        const {props, logo, title, subtitle} = this

        //Bounds.debug([new Bounds(props.x, props.y+title.height+2, subtitle.width, subtitle.height)])

        return <g>
            <Logo {...logo.props} x={props.x+props.width-logo.width} y={props.y}/>
            <a href={props.titleLink} target="_blank">
                <Paragraph {...title.props} x={props.x} y={props.y}>{title.text}</Paragraph>
            </a>
            <Paragraph {...subtitle.props} x={props.x} y={props.y+title.height+2}>{subtitle.text}</Paragraph>
        </g>
    }
}

export default function(chart) {
	var headerControl = dataflow();

	headerControl.needs('containerNode', 'bounds');

	headerControl.inputs({
		titleTemplate: "",
		titleLink: "",
		subtitleTemplate: "",
		logosSVG: [],
		entities: [],
		entityType: "",
		minYear: null,
		maxYear: null,
	});

	// Replaces things like *time* and *country* with the actual time and
	// country displayed by the current chart context
	headerControl.flow("fillTemplate : minYear, maxYear, entities, entityType", function(minYear, maxYear, entities, entityType) {
		return function(text) {
			if (_.includes(text, "*country*")) {
				var entityStr = _.map(entities, "name").join(', ');
				text = text.replace("*country*", entityStr || ("in selected " + entityType));
			}

			if (_.includes(text, "*time")) {
				if (!_.isFinite(minYear)) {
					text = text.replace("*time*", "over time");
				} else {
					var timeFrom = owid.displayYear(minYear),
						timeTo = owid.displayYear(maxYear),
						time = timeFrom === timeTo ? timeFrom : timeFrom + " to " + timeTo;

					text = text.replace("*time*", time);
					text = text.replace("*timeFrom*", timeFrom);
					text = text.replace("*timeTo*", timeTo);
				}
			}

			return text;
		};
	});

	headerControl.flow("titleStr : titleTemplate, fillTemplate", function(titleTemplate, fillTemplate) {
		return fillTemplate(titleTemplate);
	});

	headerControl.flow("subtitleStr : subtitleTemplate, fillTemplate", function(subtitleTemplate, fillTemplate) {
		return fillTemplate(subtitleTemplate);
	});

    let rootNode = null
	headerControl.flow('containerNode, bounds, logosSVG, titleStr, titleLink, subtitleStr', function(containerNode, bounds, logosSVG, titleStr, titleLink, subtitleStr) {
        rootNode = render(<Header title={titleStr} subtitle={subtitleStr} logosSVG={logosSVG} x={bounds.left} y={bounds.top} width={bounds.width} titleLink={titleLink} ref={e => headerControl.view = { bbox: { height: e.height }}}/>, chart.svg.node(), rootNode)

        document.title = titleStr
	});

	headerControl.render = function(bounds, done) {
		bounds = bounds || this.cachedBounds
		this.cachedBounds = bounds

		var minYear, maxYear, disclaimer="";
		if (chart.activeTabName == "map") {
			chart.mapdata.update();

			var mapConfig = chart.map.attributes,
				timeFrom = chart.mapdata.minToleranceYear || mapConfig.targetYear,
				timeTo = chart.mapdata.maxToleranceYear || mapConfig.targetYear,
				year = mapConfig.targetYear,
				hasTargetYear = _.find(chart.mapdata.currentValues, function(d) { return d.year == year; }),
				d = owid.displayYear,
				timeline = chart.tabs.map.timeline;

			if (timeline && (timeline.isPlaying || timeline.isDragging))
				disclaimer = "";
			else if (hasTargetYear && timeFrom != timeTo) {
				// The target year is in the data but we're displaying a range, meaning not available for all countries
				disclaimer = " Since some observations for " + d(year) + " are not available the map displays the closest available data (" + d(timeFrom) + " to " + d(timeTo) + ").";
			} else if (!hasTargetYear && timeFrom != timeTo) {
				// The target year isn't in the data at all and we're displaying a range of other nearby values
				disclaimer = " Since observations for " + d(year) + " are not available the map displays the closest available data (" + d(timeFrom) + " to " + d(timeTo) + ").";
			} else if (!hasTargetYear && timeFrom == timeTo && timeFrom != year) {
				// The target year isn't in the data and we're displaying some other single year
				disclaimer = " Since observations for " + d(year) + " are not available the map displays the closest available data (from " + d(timeFrom) + ").";
			} else if (!hasTargetYear) {
				disclaimer = " No observations are available for this year.";
			} else {
//				disclaimer = "<span style='visibility: hidden;'>A rather long placeholder to ensure that the text flow remains the same when changing between various years.</span>";
				disclaimer = "";
			}

			minYear = year;
			maxYear = year;
		} else if (chart.model.get('chart-type') == App.ChartType.ScatterPlot) {
			minYear = (chart.model.get('chart-time')||[])[0];
			maxYear = (chart.model.get('chart-time')||[])[1];
		} else if (chart.model.get('chart-type') == App.ChartType.SlopeChart) {
			minYear = chart.tabs.chart.minYear
			maxYear = chart.tabs.chart.maxYear
		} else {
			minYear = chart.data.get('minYear');
			maxYear = chart.data.get('maxYear');
		}

		var baseUrl = Global.rootUrl + "/" + chart.model.get("slug"),
			queryParams = owid.getQueryParams(),
			queryStr = owid.queryParamsToStr(queryParams),
			canonicalUrl = baseUrl + queryStr;

		headerControl.update({
			containerNode: chart.svg.node(),
			bounds: bounds,
			titleTemplate: chart.model.get('title'),
			titleLink: canonicalUrl,
			subtitleTemplate: chart.model.get('subtitle') + disclaimer,
			logosSVG: chart.model.get('logosSVG'),
			entities: chart.model.getSelectedEntities(),
			entityType: chart.model.get('entity-type'),
			minYear: minYear,
			maxYear: maxYear
		}, done);
	};

	return headerControl;
}
