import { expect, it } from "vitest"

import { PointVector } from "./PointVector.js"

// Geometry calculations rely on magnitude preserving Euclidean distance. A
// 6-8-10 triangle makes both coordinates' contribution easy to verify.
it("computes the Euclidean magnitude from both coordinates", () => {
    const point = new PointVector(6, 8)
    expect(point.magnitude).toBe(10)
})
