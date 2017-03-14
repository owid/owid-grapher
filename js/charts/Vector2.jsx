/* Vector2.jsx
 * ================                                                             
 *
 * Vector utility class
 * Partly based on the Unity vector: https://docs.unity3d.com/ScriptReference/Vector2.html
 * Wraps the Victor library, mainly so we can do type hinting
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-03-15
 */ 

// @flow

import _ from 'lodash'
import Victor from 'victor'

export default class Vector2 {
	v: Victor

	static distanceSq(a: Vector2, b: Vector2): number {
		return (b.x-a.x)**2 + (b.y-a.y)**2
	}

	static distance(a: Vector2, b: Vector2): number {
		return Math.sqrt(Vector2.distanceSq(a, b))
	}

	// From: http://stackoverflow.com/a/1501725/1983739
	static distanceFromPointToLineSq(p: Vector2, v: Vector2, w: Vector2): number {
		const l2 = Vector2.distanceSq(v, w)
		if (l2 == 0) 
			return Vector2.distanceSq(p, v)

		let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
		t = Math.max(0, Math.min(1, t))
		return Vector2.distanceSq(p, new Vector2(v.x + t * (w.x - v.x), v.y + t * (w.y - v.y)))
	}

	static distanceFromPointToLine(p: Vector2, v: Vector2, w: Vector2): number {
		return Math.sqrt(Vector2.distanceFromPointToLineSq(p, v, w))
	}

	static fromArray(a: [number, number]): Vector2 {
		return new Vector2(a[0], a[1])
	}

	static fromObject(o: { x: number, y: number }): Vector2 {
		return new Vector2(o.x, o.y)
	}

	static fromVictor(v: Victor): Vector2 {
		return new Vector2(v.x, v.y)
	}

	get x(): number { return this.v.x }
	get y(): number { return this.v.y }

	subtract(v: Vector2): Vector2 {
		return Vector2.fromVictor(this.v.subtract(v))
	}

	add(v: Vector2): Vector2 {
		return Vector2.fromVictor(this.v.add(v))
	}

	magnitude() {
		return this.v.magnitude()
	}

	toString() {
		return `Vector2<${this.x}, ${this.y}>`
	}

	constructor(x: number, y: number) {
		this.v = new Victor(x, y)
	}
}