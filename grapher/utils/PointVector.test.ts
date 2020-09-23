#! /usr/bin/env yarn jest

import { PointVector } from "./PointVector"

describe("basics", () => {
    it("can report the center", () => {
        const point = new PointVector(6, 8)
        expect(point.magnitude).toEqual(10)
    })
})
