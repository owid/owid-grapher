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

import * as _ from 'lodash'
import Victor = require('victor')

export default class Vector2 {
    static get epsilon() {
        return 1E-05
    }

	x: number
	y: number

    static get left() {
        return new Vector2(-1, 0)
    }

    static get right() {
        return new Vector2(1, 0)
    }

    static get up() {
        return new Vector2(0, -1)
    }

    static get down() {
        return new Vector2(0, 1)
    }

	static distanceSq(a: Vector2, b: Vector2): number {
		return (b.x-a.x)**2 + (b.y-a.y)**2
	}

	static distance(a: Vector2, b: Vector2): number {
		return Math.sqrt(Vector2.distanceSq(a, b))
	}

    static angle(a: Vector2, b: Vector2): number {
        return Math.acos(Math.max(Math.min(Vector2.dot(a.normalize(), b.normalize()), 1), -1)) * 57.29578
    }

    static dot(lhs: Vector2, rhs: Vector2) {
        return lhs.x * rhs.x + lhs.y * rhs.y
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

	static intersectLines(a0: Vector2, a1: Vector2, b0: Vector2, b1: Vector2) {
	    var ua, ub, denom = (b1.y - b0.y)*(a1.x - a0.x) - (b1.x - b0.x)*(a1.y - a0.y);
	    if (denom == 0) {
	        return null;
	    }
	    ua = ((b1.x - b0.x)*(a0.y - b0.y) - (b1.y - b0.y)*(a0.x - b0.x))/denom;
	    ub = ((a1.x - a0.x)*(a0.y - b0.y) - (a1.y - a0.y)*(a0.x - b0.x))/denom;

	    const x = a0.x + ua*(a1.x - a0.x)
	    const y = a0.y + ua*(a1.y - a0.y)

	    return new Vector2(x, y)
    }

	subtract(v: Vector2): Vector2 {
		return Vector2.fromObject(new Victor(this.x, this.y).subtract(new Victor(v.x, v.y)))
	}

	add(v: Vector2): Vector2 {
		return Vector2.fromObject(new Victor(this.x, this.y).add(new Victor(v.x, v.y)))
	}

	times(n: number): Vector2 {
		return new Vector2(this.x*n, this.y*n)
	}

	clone(): Vector2 {
		return new Vector2(this.x, this.y)
	}

	magnitude(): number {
		return new Victor(this.x, this.y).magnitude()
	}

    normalize(): Vector2 {
        return Vector2.fromObject(new Victor(this.x, this.y).normalize())
    }

    normals(): Vector2[] {
        return [new Vector2(-this.y, this.x), new Vector2(this.y, -this.x)]
    }

    invert(): Vector2 {
        return this.times(-1)
    }

    equals(other: Vector2): boolean {
        return other.subtract(this).magnitude() < Vector2.epsilon
    }

	toString(): string {
		return `Vector2<${this.x}, ${this.y}>`
	}

	constructor(x: number, y: number) {
		this.x = x
		this.y = y
	}
}
