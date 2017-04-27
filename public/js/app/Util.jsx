// @flow

import Bounds from './Bounds'
import {cloneElement} from 'preact'
import {map} from 'underscore'

export type SVGElement = any;
export type VNode = any;
export const NullElement : any = () => null;

import React, {Component} from 'react'

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

export function preInstantiate(vnode: VNode) {
    return new vnode.nodeName(vnode.props)
}

export function cacheChild(parent, key: string, vnode: VNode) {
    key = "_"+key

    if (!parent[key] && vnode) {
        parent[key] = new vnode.nodeName(vnode.props)
    } else if (parent[key] && !vnode) {
        parent[key] = null
    }

    if (parent[key])
        parent[key].props = vnode.props
    return parent[key]
}
