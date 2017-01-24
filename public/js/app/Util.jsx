// @flow

import Bounds from './Bounds'
import {cloneElement} from 'preact'
import {map} from '../libs/underscore'

export type SVGElement = any;
export const NullElement : any = () => null;


export function getRelativeMouse(node : SVGElement, event : MouseEvent) {
  var svg = node.ownerSVGElement || node;

  if (svg.createSVGPoint) {
    var point = svg.createSVGPoint();
    point.x = event.clientX, point.y = event.clientY;
    point = point.matrixTransform(node.getScreenCTM().inverse());
    return [point.x, point.y];
  }

  var rect = node.getBoundingClientRect();
  return [event.clientX - rect.left - node.clientLeft, event.clientY - rect.top - node.clientTop];
};

export function layout(containerBounds : Bounds, ...children : any[]) {
    children = map(children, (vnode) => {
        if (vnode.nodeName.calculateBounds) {
            const bounds = vnode.nodeName.calculateBounds(containerBounds, vnode.attributes)
            if (vnode.attributes) {
            	const layout = vnode.attributes.layout
            	if (layout == 'top')
    	            containerBounds = containerBounds.padTop(bounds.height)
            	if (layout == 'bottom')
    	            containerBounds = containerBounds.padBottom(bounds.height)
            	if (layout == 'left')
    	            containerBounds = containerBounds.padLeft(bounds.width)
            	if (layout == 'right')
    	            containerBounds = containerBounds.padRight(bounds.width)
            }
            return cloneElement(vnode, { bounds: bounds })
        } else {
            return vnode
        }
    })

    children = map(children, (vnode) => {
        if (!vnode.attributes || !vnode.attributes.bounds) {
            return cloneElement(vnode, { bounds: containerBounds })
        } else {
            return vnode
        }
    })

    return children
}
