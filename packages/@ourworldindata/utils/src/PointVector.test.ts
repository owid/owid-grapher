import { expect, it, describe } from "vitest"

import { PointVector } from "./PointVector.js"

it("can report the center", () => {
    const point = new PointVector(6, 8)
    expect(point.magnitude).toEqual(10)
})
