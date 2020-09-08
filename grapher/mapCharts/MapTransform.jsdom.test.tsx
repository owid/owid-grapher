#! /usr/bin/env yarn jest

import { MapTransform } from "./MapTransform"
import { Grapher } from "grapher/core/Grapher"

describe(MapTransform, () => {
    test("can create a transform", () => {
        const transform = new MapTransform(new Grapher())
        expect(transform.columnSlug).toBe(undefined)
    })
})
