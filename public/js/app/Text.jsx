// @flow

import { h, render, Component } from 'preact'
import { observable, computed, asFlat } from 'mobx'

export default class Text extends Component {
	render() {
		return <text {...this.props}></text>
	}
}