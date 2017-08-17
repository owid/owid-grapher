import * as React from 'react'
import Bounds from './Bounds'
import TextWrap from './TextWrap'

export default class NoData extends React.Component<{bounds: Bounds, message?: string}> {
	render() {
		const {bounds, message} = this.props
		const msgWrap = new TextWrap({ maxWidth: bounds.width, text: message||"No available data" })
		return <g className="NoData">
			{msgWrap.render(bounds.x+bounds.width/2-msgWrap.width/2, bounds.y+bounds.height/2-msgWrap.height/2, { fill: "#444" })}
		</g>
	}
}