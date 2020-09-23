/*
 * Vector utility class
 * Partly based on the Unity vector: https://docs.unity3d.com/ScriptReference/Vector2.html
 * Wraps the Victor library, mainly so we can do type hinting
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-03-15
 */

export class PointVector {
    x: number
    y: number

    constructor(x: number, y: number) {
        this.x = x
        this.y = y
    }

    subtract(v: PointVector) {
        return new PointVector(this.x - v.x, this.y - v.y)
    }

    add(v: PointVector) {
        return new PointVector(this.x + v.x, this.y + v.y)
    }

    times(n: number) {
        return new PointVector(this.x * n, this.y * n)
    }

    get magnitude() {
        return Math.sqrt(this.x ** 2 + this.y ** 2)
    }

    normalize() {
        const magnitude = this.magnitude
        if (magnitude > 1e-5)
            return new PointVector(this.x / magnitude, this.y / magnitude)

        return new PointVector(0, 0)
    }

    normals(): [PointVector, PointVector] {
        return [
            new PointVector(-this.y, this.x),
            new PointVector(this.y, -this.x),
        ]
    }

    toString() {
        return `PointVector<${this.x}, ${this.y}>`
    }

    static up = new PointVector(0, -1)
    static zero = new PointVector(0, 0)

    static distanceSq(a: PointVector, b: PointVector) {
        return (b.x - a.x) ** 2 + (b.y - a.y) ** 2
    }

    static distance(a: PointVector, b: PointVector) {
        return Math.sqrt(PointVector.distanceSq(a, b))
    }

    static angle(a: PointVector, b: PointVector) {
        return (
            Math.acos(
                Math.max(
                    Math.min(PointVector.dot(a.normalize(), b.normalize()), 1),
                    -1
                )
            ) * 57.29578
        )
    }

    private static dot(lhs: PointVector, rhs: PointVector) {
        return lhs.x * rhs.x + lhs.y * rhs.y
    }

    // From: http://stackoverflow.com/a/1501725/1983739
    static distanceFromPointToLineSq(
        p: PointVector,
        v: PointVector,
        w: PointVector
    ) {
        const l2 = PointVector.distanceSq(v, w)
        if (l2 === 0) return PointVector.distanceSq(p, v)

        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
        t = Math.max(0, Math.min(1, t))
        return PointVector.distanceSq(
            p,
            new PointVector(v.x + t * (w.x - v.x), v.y + t * (w.y - v.y))
        )
    }
}
