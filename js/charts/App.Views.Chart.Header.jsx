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
        return 50
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
        return <g transform={`translate(${props.x}, ${props.y}) scale(${scale})`} dangerouslySetInnerHTML={{ __html: svg }}/>
    }
}

class Header extends Component {
    @computed get logo() {
        return preInstantiate(<Logo svg={this.props.logosSVG[0]}/>)
    }

    @computed get title() {
        const {props, logo} = this

        // Try to fit the title into a single line if possible-- but not if it would make the text super small
        let title = null
        let fontSize = 1.5
        while (fontSize > 1.0) {
            title = preInstantiate(<Paragraph width={props.width-logo.width}>{props.title}</Paragraph>)
            if (title.lines.length <= 1)
                break
            fontSize -= 0.05
        }

        return title
    }

    @computed get subtitle() {
        const {props, logo, title} = this
        // If the subtitle is entirely below the logo, we can go underneath it
        const subtitleWidth = title.height > logo.height ? props.width : props.width-logo.width

        return preInstantiate(<Paragraph width={subtitleWidth}/>)
    }

    render() {
        const {props, logo, title, subtitle} = this

        return <g>
            <Logo {...logo.props} x={props.x+props.width-logo.width} y={props.y}/>
            <Paragraph {...title.props} x={props.x} y={props.y}>{props.title}</Paragraph>
            <Paragraph {...subtitle.props} x={props.x} y={props.y+title.height}>{props.subtitle}</Paragraph>
        </g>
    }
}

function owid_header() {
	var header = dataflow();

	header.needs('containerNode', 'bounds', 'titleStr');

	header.defaults({
		titleLink: "",
		subtitleStr: "",
		logosSVG: []
	});

	header.initial('titleSizeScale', function() {
		return d3.scaleLinear().domain([30, 150]).range([1.5, 0.75]).clamp(true);
	});

	header.flow('g : containerNode', function(containerNode) {
		return d3.select(containerNode).append('g').attr('class', 'header');
	});

	// Render the logos first as they affect the positioning of the text

	header.flow('boundsForText, logoHeight : g, logosSVG, bounds', function(g, logosSVG, bounds) {
		var logoUpdate = g.selectAll('.logo').data(logosSVG||[]);
		var logos = logoUpdate.enter().append('g').attr('class', 'logo').merge(logoUpdate);

		// Go through and position/scale the logos as needed
		var targetHeight = 50;
		var offsetX = bounds.width;
        var logoHeight = 0;
		logos.each(function(d) {
			this.innerSVG = d.match(/<svg>(.*)<\/svg>/)[1]||d;

			var bbox = this.getBBox();
			var scale = targetHeight/bbox.height;
            offsetX -= bbox.width*scale;

			d3.select(this).attr('transform', 'translate(' + offsetX + ',' + 0 + ') scale(' + scale + ')');
            logoHeight = bbox.height*scale;
		});

		return [new Bounds(0, 0, offsetX-10, bounds.height), logoHeight];
	});

	header.flow('titleLinkEl : g', function(g) {
		return g.append('a').attr('class', 'title').attr('target', '_blank');
	});

	header.flow('titleLinkEl, titleLink', function(titleLinkEl, titleLink) {
		titleLinkEl.attr('xlink:href', titleLink);
	});

	header.flow('title : titleLinkEl', function(titleLinkEl) {
		return titleLinkEl.append('text')
			.attr('dy', '1em');
	});

	header.flow('title, boundsForText', function(title, boundsForText) {
		title.attr('x', boundsForText.left)
			.attr('y', boundsForText.top);
	});

	header.flow('title, titleStr, titleSizeScale', function(title, titleStr, titleSizeScale) {
		title.style('font-size', titleSizeScale(stripTags(titleStr).length) + 'em');
	});

	header.flow('titleBox, titleFontSize : title, titleStr, boundsForText', function(title, titleStr, boundsForText) {
		// Try to fit the title into a single line if possible-- but not if it would make the text super small

		function resizeTitle(fontSize) {
			title.style('font-size', fontSize + 'em');
			owid.svgSetWrappedText(title, titleStr, boundsForText.width, { lineHeight: 1.1 });
		}

		var fontSize = 1.5;
		resizeTitle(fontSize);
		while (fontSize > 1.0 && title.selectAll('tspan').size() > 1) {
			resizeTitle(fontSize);
			fontSize -= 0.05;
		}

		if (fontSize <= 1.0)
			resizeTitle(1.2);

		title.attr('y', boundsForText.top);
		title.attr('y', boundsForText.top-title.node().getBBox().y);

		return [Bounds.fromBBox(title.node().getBBox()), fontSize];
	});

	header.flow('subtitle : g', function(g) {
		return g.append('text')
			.attr('class', 'subtitle')
			.attr('dy', '1em');
	});

	header.flow('subtitle, titleBox, titleFontSize, subtitleStr, boundsForText, logoHeight, bounds, g', function(subtitle, titleBox, titleFontSize, subtitleStr, boundsForText, logoHeight, bounds, g) {
        var width = boundsForText.width;
        if (titleBox.height > logoHeight)
            width = bounds.width;

		subtitle.attr('x', boundsForText.left+1).attr('y', boundsForText.top + titleBox.height);

		// Subtitle text must always be smaller than title text.
		var fontSize = Math.min(0.8, titleFontSize-0.3);
		subtitle.style('font-size', fontSize+'em');
		owid.svgSetWrappedText(subtitle, subtitleStr, width, { lineHeight: 1.2 });

		// Make it a little bit smaller if it still goes across many lines
		if (subtitle.selectAll('tspan').size() > 2) {
			fontSize = Math.min(0.65, fontSize);
			subtitle.style('font-size', fontSize+'em');
			owid.svgSetWrappedText(subtitle, subtitleStr, width, { lineHeight: 1.2 });
		}
	});

    header.flow('bbox : g, titleStr, subtitleStr, boundsForText', function(g) {
        g.selectAll('.bgRect').remove();
        var bbox = g.node().getBBox();
        g.insert('rect', '*').attr('class', 'bgRect').attr('x', 0).attr('y', 0).style('fill', 'white')
                .attr('width', bbox.width+1).attr('height', bbox.height+10);
        return g.node().getBBox();
    });

	header.flow('g, bounds', function(g, bounds) {
		g.attr('transform', 'translate(' + bounds.left + ',' + bounds.top + ')');
	});

	return header;
};

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

	var header = owid_header();

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

	headerControl.flow('containerNode, bounds, logosSVG, titleStr, titleLink, subtitleStr', function(containerNode, bounds, logosSVG, titleStr, titleLink, subtitleStr) {
		header.update({
			containerNode: containerNode,
			bounds: bounds,
			logosSVG: logosSVG,
			titleStr: titleStr,
			titleLink: titleLink,
			subtitleStr: subtitleStr,
		}, function() {
            document.title = titleStr;
        });
	});

    let rootNode = null
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

        rootNode = render(<Header title={chart.model.get('title')} subtitle={chart.model.get('subtitle')} logosSVG={chart.model.get('logosSVG')} x={bounds.left} y={bounds.top} width={bounds.width}/>, chart.svg.node(), rootNode)
        headerControl.view = { bbox: { height: 100 }}

		/*headerControl.update({
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
		}, done);*/
	};

	return headerControl;
}
