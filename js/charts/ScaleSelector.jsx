/* ScaleSelector.jsx
 * ================
 *
 * Small toggle component for switching between log/linear (or any other) scale types.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-02-11
 */

// @flow

import * as d3 from 'd3'
import React, { Component } from 'react'
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'
import {bind} from 'decko'

import Text from './Text'

export type ScaleType = 'linear' | 'log';

@observer
export default class ScaleSelector extends Component {
	props: {
		x: number,
		y: number,
		scaleType: ScaleType,
		scaleTypeOptions: ScaleType[],
		onChange: (ScaleType) => void
	}

	@computed get x() : number { return this.props.x }
	@computed get y() : number { return this.props.y }

	@computed get scaleTypeOptions() : ScaleType[] {
		return this.props.scaleTypeOptions
	}

	@computed get scaleType() : ScaleType {
		return this.props.scaleType
	}

	@bind @action onClick() {
		const { scaleType, scaleTypeOptions } = this

		let nextScaleTypeIndex = scaleTypeOptions.indexOf(scaleType)+1
		if (nextScaleTypeIndex >= scaleTypeOptions.length)
			nextScaleTypeIndex = 0


		this.props.onChange(scaleTypeOptions[nextScaleTypeIndex])
	}

	render() {
		const { x, y, onClick, scaleType } = this

		return <Text x={x} y={y} onClick={onClick} dominant-baseline="middle" style={{'font-size': '12px', 'text-transform': 'uppercase', 'cursor': 'pointer'}}><tspan style={{'font-family': "FontAwesome"}}>{'\uf013'}</tspan> {scaleType}</Text>
	}
}
