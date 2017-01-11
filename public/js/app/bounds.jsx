// @flow

import * as _ from '../libs/underscore'
import * as d3 from '../libs/d3.v4'

export default class Bounds {
	x: number
	y: number
	width: number
	height: number

	constructor(x: number, y: number, width: number, height: number) {
		this.x = x
		this.y = y
		this.width = width
		this.height = height
	}

	static fromProps(props: { x: number, y: number, width: number, height: number }): Bounds {
		const { x, y, width, height } = props
		return new Bounds(x, y, width, height)
	}

	static textBoundsCache = new Map()
	static forText(str: string, { fontSize = '1em' }): Bounds {
		const key = str+'-'+fontSize
		let bounds = this.textBoundsCache.get(key)
		if (bounds) return bounds

		const update = d3.select('svg').selectAll('.tmpTextCalc').data([str]);

		const text = update.enter().append('text')
			.attr('class', 'tmpTextCalc')
			.attr('opacity', 0)
			.merge(update)
  			  .attr('font-size', fontSize)
			  .text(function(d) { return d; });

		bounds = Bounds.fromProps(text.node().getBBox())
		this.textBoundsCache.set(key, bounds)
		return bounds
	}


	get left(): number { return this.x }
	get top(): number { return this.y }
	get right(): number { return this.x+this.width }
	get bottom(): number { return this.y+this.height }

	padLeft(amount: number): Bounds {
		return new Bounds(this.x+amount, this.y, this.width-amount, this.height)
	}

	padRight(amount: number): Bounds {
		return new Bounds(this.x, this.y, this.width-amount, this.height)
	}

	padWidth(amount: number): Bounds {
		return new Bounds(this.x+amount, this.y, this.width-amount, this.height)
	}

	pad(amount: number): Bounds {
		return new Bounds(this.x+amount, this.y+amount, this.width-amount*2, this.height-amount*2)
	}

	extend(props: { x?: number, y?: number, width?: number, height?: number }): Bounds {
		return Bounds.fromProps(_.extend({}, this, props))
	}

	intersects(otherBounds: Bounds): boolean {
		const r1 = this, r2 = otherBounds

	    return !(r2.left > r1.right || r2.right < r1.left || 
             r2.top > r1.bottom || r2.bottom < r1.top)
	}
}

