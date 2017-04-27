// @flow

import * as _ from 'underscore'
import * as d3 from 'd3'
import React, {Component, cloneElement} from 'react'
import Bounds from './Bounds'

export default class Layout extends Component {
	static bounds = new Bounds(0,0,0,0)

	props: {
		bounds: Bounds
	}

	render() {
		let children = this.props.children,
			containerBounds = this.props.bounds

	    children = _.map(children, (vnode) => {
	    	if (!vnode.nodeName) return vnode

	        if (vnode.nodeName.calculateBounds) {
	            let precalc = vnode.nodeName.calculateBounds(containerBounds, vnode.attributes)
                const bounds = containerBounds
                containerBounds = precalc.remainingBounds

	            return cloneElement(vnode, _.extend({ bounds: bounds }, precalc.props||{}))
	        } else {
	            return vnode
	        }
	    })

	    children = _.map(children, (vnode) => {
	        if (vnode.nodeName && (!vnode.attributes || !vnode.attributes.bounds || vnode.attributes.bounds == Layout.bounds)) {
	            return cloneElement(vnode, { bounds: containerBounds })
	        } else {
	            return vnode
	        }
	    })

		return <g {...this.props}>
			{children}
		</g>
	}
}

