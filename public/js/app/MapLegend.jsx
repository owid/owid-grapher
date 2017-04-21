// @flow

import * as _ from 'underscore'
import * as d3 from 'd3'
import owid from '../owid'
import Bounds from './Bounds'
import React, {Component} from 'react'
import {observable, computed, asFlat} from 'mobx'
import type {SVGElement} from './Util'
import Paragraph from './Paragraph'

export class MapLegend extends Component {
	g: SVGElement
	dataflow: any

	componentDidUpdate() {
		/*this.dataflow.update({
			g: d3.select(this.g),
			legendData: this.props.legendData,
			title: this.props.title,
			outerBounds: this.props.bounds
		})*/
	}

    static calculateBounds(bounds : Bounds, props : any) : Bounds {
        const {title} = props
        const wrapLabel = Paragraph.wrap(title, bounds.width, { fontSize: "0.7em" })
        const rectHeight = 10
        const height = wrapLabel.height+rectHeight

        return {
            bounds: new Bounds(bounds.left, bounds.bottom-height, bounds.width, height),
            wrapLabel: wrapLabel,
            rectHeight: rectHeight
        }
    }

    @computed get bounds() : Bounds {
        return this.props.bounds.padWidth(this.props.bounds.width*0.2)
    }

	render() {
        const {legendData, title, wrapLabel, rectHeight} = this.props
        const {bounds} = this
        const rangeSize = legendData[legendData.length-2].max - _.first(legendData).min

		return <g class="mapLegend" ref={(g) => this.g = g} transform={`translate(${bounds.x}, ${bounds.y})`}>
            {_.map(legendData.slice(0, -1), d => {
                const xFrac = d.min/rangeSize
                const widthFrac = d.max/rangeSize - xFrac

                return <rect x={xFrac*bounds.width} y={bounds.height-rectHeight-wrapLabel.height-5} width={widthFrac*bounds.width} height={rectHeight} fill={d.color}/>
            })}
            <Paragraph x={bounds.width/2} y={bounds.height-wrapLabel.height} dominant-baseline="hanging" text-anchor="middle">{wrapLabel}</Paragraph>
		</g>
	}
}

owid.view.mapLegend = function() {
	var legend = owid.dataflow();

	legend.requires('title', 'legendData', 'outerBounds', 'g');

	// Allow hiding items from legend
	legend.flow('legendData : legendData', function(legendData) {
		return _.filter(legendData, function(d) { return !d.hidden; });
	});

	// Work out how much of the space we want to use
	legend.flow('targetWidth, targetHeight : outerBounds', function(outerBounds) {
        var mapBBox = d3.select('.map > .subunits').node().getBBox();

		return [
			Math.min(mapBBox.width, outerBounds.width)*0.2,
			Math.min(mapBBox.height, outerBounds.height)*0.7
		];
	});

	// Main work: the actual colored boxes part of the legend
	legend.flow('gSteps : g', function(g) {
		return g.append('g').attr('class', 'steps');
	});
	legend.flow('steps : gSteps, legendData', function(gSteps, legendData) {
		var stepsUpdate = gSteps.selectAll('.legend-step').data(legendData);
		stepsUpdate.exit().remove();

		var enter = stepsUpdate.enter().append('g').attr('class', 'legend-step');
		enter.append('rect');

		return enter.merge(stepsUpdate);
	});
	legend.flow('stepsHeight : steps, targetHeight, legendData', function(steps, targetHeight) {
		var stepSize = Math.min(30, Math.max(15, targetHeight / steps.size())),
			stepWidth = stepSize,
			stepHeight = stepSize,
			stepGap = Math.min(stepSize/8, 2);

		steps.selectAll('rect')
			.data(function(d) { return [d]; })
			.attr("width", stepWidth)
			.attr("height", stepHeight)
			.style("fill", function(d, i) { return d.color; });

		var prevData = null, currentStepOffset = 0;
		steps.selectAll('text').remove();
		steps.each(function(d) {
			var step = d3.select(this);

			// Position the step as a whole
			if (prevData && prevData.type != d.type) {
				// Spacing between numeric/categorical sections
				currentStepOffset += stepGap*3;
			}
			step.attr("transform", "translate(" + 0 + ", " + currentStepOffset + ")");
			currentStepOffset += stepHeight + stepGap;

			// Fill and position the text
			var text = d3.select(this).selectAll('text');
			if (d.type == 'categorical' || d.text) {
				step.append('text').text(d.text)
					.attr('x', stepWidth+5)
					.attr('y', stepHeight/2)
					.attr('dy', '.4em');
			} else if (d.type == 'numeric') {
				if (!prevData || !_.has(prevData, 'max'))
					step.append('text').text(d.minText).attr('x', stepWidth+5);
				step.append('text').text(d.maxText)
					.attr('x', stepWidth+5)
					.attr('y', stepHeight);
			}
			prevData = d;
		});

		return currentStepOffset;
	});

	// Create and position/scale label, if any
	legend.flow('label : g', function(g) {
		return g.append('text').attr('class', 'map-label');
	});
	legend.flow('labelBBox : label, title', function(label, title) {
		label.text(title);
		return label.node().getBBox();
	});
	legend.flow('label, labelBBox, stepsHeight, outerBounds', function(label, labelBBox, stepsHeight, outerBounds) {
		var scale = Math.min(1, outerBounds.height/(labelBBox.width+50));
		label.attr("transform", "translate(" + (outerBounds.left + labelBBox.height/2 + 5) + "," + (outerBounds.top + outerBounds.height-11) + ") rotate(270) scale(" + scale + ")");
	});

	// Position and scale steps to fit
	legend.flow('gSteps, labelBBox, outerBounds, targetWidth, targetHeight, stepsHeight', function(gSteps, labelBBox, outerBounds, targetWidth, targetHeight, stepsHeight) {
		var bbox = gSteps.node().getBBox();
		var scale = Math.min(1, Math.min((targetWidth-labelBBox.height)/bbox.width, targetHeight/bbox.height));

		gSteps.attr('transform', 'translate(' + (outerBounds.left+labelBBox.height) + ',' + (outerBounds.top+outerBounds.height-(stepsHeight*scale)-10) + ')' + ' scale(' + scale + ')');
	});

	legend.beforeClean(function() {
		if (legend.g) legend.g.remove();
	});

	return legend;
};
