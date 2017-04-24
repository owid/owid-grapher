// @flow

import * as _ from 'underscore'
import * as d3 from 'd3'
import owid from '../owid'
import Bounds from './Bounds'
import React, {Component} from 'react'
import {observable, computed, asFlat} from 'mobx'
import type {SVGElement} from './Util'
import Paragraph from './Paragraph'
import Text from './Text'

class MapLegendLayout {
    @observable containerBounds: Bounds
    @observable title: string

    @observable props

    constructor(containerBounds, { title }) {
        this.title = title
        this.containerBounds = containerBounds
    }

    @computed get bounds() {
        return this.containerBounds.padWidth(this.containerBounds.width*0.25)
    }
}

export class MapLegend extends Component {
    static calculateBounds(containerBounds, props) {
        const legend = new MapLegend()
        legend.props = _.extend({}, props, { bounds: containerBounds })

        return {
            remainingBounds: containerBounds.padBottom(legend.height),
            props: {
                fromLayout: legend
            }
        }
    }

    @computed get bounds() {
        return this.props.bounds.padWidth(this.props.bounds.width*0.25)
    }

    @computed get wrapLabel() {
        return Paragraph.wrap(""/*this.props.title*/, this.width, { fontSize: "0.6em" })
    }

    @computed get rectHeight() {
        return 10
    }

    @computed get height() {
        return this.wrapLabel.height+this.rectHeight+23
    }

    @computed get minValue() {
        return _.first(this.props.legendData).min
    }

    @computed get maxValue() {
        return this.props.legendData[this.props.legendData.length-2].max
    }

    @computed get rangeSize() {
        return this.maxValue - this.minValue
    }

    @computed get numericLabelsInitial() {
        const {legendData} = this.props
        const {bounds, minValue, rangeSize, rectHeight, wrapLabel} = this

        const labels = _.map(legendData.slice(0, -1), d => {
            const fontSize = "0.55em"
            const labelBounds = Bounds.forText(d.minText, { fontSize: fontSize })
            const x = bounds.left+((d.min-minValue)/rangeSize)*bounds.width - labelBounds.width/2
            const y = bounds.bottom-labelBounds.height

            return {
                text: d.minText,
                fontSize: fontSize,
                bounds: labelBounds.extend({ x: x, y: y }),
                underneath: true
            }
        })

        return labels
    }

    @computed get underHeight() {
        return _.max(_.map(this.numericLabelsInitial, l => l.bounds.height))+2
    }

    @computed get numericLabels() {
        const {bounds, rectHeight, numericLabelsInitial, underHeight} = this

        const labels = []
        _.each(numericLabelsInitial, l => labels.push(_.clone(l)))

        for (var i = 1; i < labels.length; i++) {
            const l1 = labels[i-1], l2 = labels[i]
            if (l2.bounds.intersects(l1.bounds)) {
                l2.bounds = l2.bounds.extend({ y: bounds.bottom-underHeight-rectHeight-l2.bounds.height-2 })
                l2.underneath = false
            }
        }

        return labels
    }


    @computed get overHeight() {
        return _.max(_.map(this.numericLabels, l => l.underneath ? 0 : l.bounds.height))
    }

    componentDidMount() {
//        Bounds.debug(this.numericLabels.map(l => l.bounds))
    }

	render() {
        if (this.props.fromLayout)
            return this.props.fromLayout.render()

        const {legendData} = this.props
        const {bounds, wrapLabel, rectHeight, numericLabels, underHeight} = this

        const minValue = _.first(legendData).min
        const maxValue = legendData[legendData.length-2].max
        const rangeSize = maxValue - minValue

        const borderSize = 0.5
        const borderColor = "#333"

		return <g class="mapLegend" ref={(g) => this.g = g}>
            <rect x={bounds.left-borderSize} y={bounds.bottom-underHeight-rectHeight-borderSize} width={bounds.width+borderSize*2} height={rectHeight+borderSize*2} fill={borderColor}/>
            {_.map(legendData.slice(0, -1), (d, i) => {
                const xFrac = (d.min-minValue)/rangeSize
                const widthFrac = (d.max-minValue)/rangeSize - xFrac

                return [
                    <rect x={bounds.left+xFrac*bounds.width} y={bounds.bottom-underHeight-rectHeight} width={widthFrac*bounds.width} height={rectHeight} fill={d.color}/>,
                    i < legendData.length-2 && <rect x={bounds.left+((d.max-minValue)/rangeSize)*bounds.width-0.25} y={bounds.bottom-rectHeight-underHeight} width={0.5} height={rectHeight} fill={borderColor}/>
                ]
            })}
            {_.map(numericLabels, label =>
                <text x={label.bounds.x} y={label.bounds.y} fontSize={label.fontSize} dominant-baseline="hanging">{label.text}</text>
            )}
            <Paragraph x={bounds.centerX} y={bounds.bottom-wrapLabel.height} dominant-baseline="hanging" text-anchor="middle">{wrapLabel}</Paragraph>
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
