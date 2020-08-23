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

export class Vector2 {
    static left = new Vector2(-1, 0)
    static right = new Vector2(1, 0)
    static up = new Vector2(0, -1)
    static down = new Vector2(0, -1)
    static zero = new Vector2(0, 0)

    static get epsilon() {
        return 1e-5
    }

    static distanceSq(a: Vector2, b: Vector2): number {
        return (b.x - a.x) ** 2 + (b.y - a.y) ** 2
    }

    static distance(a: Vector2, b: Vector2): number {
        return Math.sqrt(Vector2.distanceSq(a, b))
    }

    static angle(a: Vector2, b: Vector2): number {
        return (
            Math.acos(
                Math.max(
                    Math.min(Vector2.dot(a.normalize(), b.normalize()), 1),
                    -1
                )
            ) * 57.29578
        )
    }

    static dot(lhs: Vector2, rhs: Vector2) {
        return lhs.x * rhs.x + lhs.y * rhs.y
    }

    // From: http://stackoverflow.com/a/1501725/1983739
    static distanceFromPointToLineSq(
        p: Vector2,
        v: Vector2,
        w: Vector2
    ): number {
        const l2 = Vector2.distanceSq(v, w)
        if (l2 === 0) return Vector2.distanceSq(p, v)

        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
        t = Math.max(0, Math.min(1, t))
        return Vector2.distanceSq(
            p,
            new Vector2(v.x + t * (w.x - v.x), v.y + t * (w.y - v.y))
        )
    }

    static distanceFromPointToLine(p: Vector2, v: Vector2, w: Vector2): number {
        return Math.sqrt(Vector2.distanceFromPointToLineSq(p, v, w))
    }

    static fromArray(a: [number, number]): Vector2 {
        return new Vector2(a[0], a[1])
    }

    static fromObject(o: { x: number; y: number }): Vector2 {
        return new Vector2(o.x, o.y)
    }

    x: number
    y: number

    constructor(x: number, y: number) {
        this.x = x
        this.y = y
    }

    subtract(v: Vector2): Vector2 {
        return new Vector2(this.x - v.x, this.y - v.y)
    }

    add(v: Vector2): Vector2 {
        return new Vector2(this.x + v.x, this.y + v.y)
    }

    times(n: number): Vector2 {
        return new Vector2(this.x * n, this.y * n)
    }

    clone(): Vector2 {
        return new Vector2(this.x, this.y)
    }

    get magnitude(): number {
        return Math.sqrt(this.x ** 2 + this.y ** 2)
    }

    normalize(): Vector2 {
        const magnitude = this.magnitude
        if (magnitude > 1e-5) {
            return new Vector2(this.x / magnitude, this.y / magnitude)
        } else {
            return new Vector2(0, 0)
        }
    }

    normals(): Vector2[] {
        return [new Vector2(-this.y, this.x), new Vector2(this.y, -this.x)]
    }

    invert(): Vector2 {
        return this.times(-1)
    }

    toString(): string {
        return `Vector2<${this.x}, ${this.y}>`
    }
}
