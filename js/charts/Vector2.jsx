/* Vector2.jsx
 * ================                                                             
 *
 * Vector utility class
 * Based on the Unity vector: https://docs.unity3d.com/ScriptReference/Vector2.html
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-03-15
 */ 

// @flow

import _ from 'lodash'

export default class Vector2 {
	x: number;
	y: number;

	static distanceSquared(a: Vector2, b: Vector2) {
		return (b.x-a.x)**2 + (b.y-a.y)**2
	}

	static distance(a: Vector2, b: Vector2) {
		return Math.sqrt(Vector2.distanceSquared(a, b))
	}

	// From: http://stackoverflow.com/a/1501725/1983739
	static distanceFromPointToLineSquared(p: Vector2, v: Vector2, w: Vector2) {
		const l2 = Vector2.distanceSquared(v, w)
		if (l2 == 0) 
			return Vector2.distanceSquared(p, v)

		let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
		t = Math.max(0, Math.min(1, t))
		return Vector2.distanceSquared(p, new Vector2(v.x + t * (w.x - v.x), v.y + t * (w.y - v.y)))
	}

	static distanceFromPointToLine(p: Vector2, v: Vector2, w: Vector2) {
		return Math.sqrt(Vector2.distanceFromPointToLineSquared(p, v, w))
	}

	static fromArray(a: [number, number]) {
		return new Vector2(a[0], a[1])
	}

	static fromObject(o: { x: number, y: number }) {
		return new Vector2(o.x, o.y)
	}
	
	constructor(x: number, y: number) {
		this.x = x
		this.y = y
	}
}