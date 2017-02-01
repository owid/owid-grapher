// @flow

import Bounds from './Bounds'
import {cloneElement} from 'preact'
import {map} from 'underscore'

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