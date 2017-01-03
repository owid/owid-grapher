// @flow

import * as _ from '../libs/underscore'
import * as d3 from '../libs/d3.v4'
import owid from '../owid'
import dataflow from './owid.dataflow'
import { h, render, Component } from 'preact'

class Axis extends Component {
	render(props : any, state) {dataflow
		let bounds = props.bounds
		return <line x1={bounds.left} y1={bounds.top} x2={bounds.left+bounds.width} y2={bounds.top+bounds.height} stroke="black" />
	}
}

class SlopeChart extends Component {
    render(props : any, state) {
	    return (
	    	<Axis bounds={props.bounds}/>
	    );
	}
}

export default function() {
	const slopeChart = dataflow()

	slopeChart.needs('containerNode', 'bounds', 'axisConfig', 'data')

	slopeChart.flow('containerNode, bounds', function(containerNode, bounds) {
		render(<SlopeChart bounds={bounds}/>, containerNode)
	})

	return slopeChart
}