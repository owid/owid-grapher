#! /usr/bin/env yarn jest

import { ColorScale } from "./ColorScale"

it("can create one", () => {
    const scale = new ColorScale()
    expect(scale.isColorSchemeInverted).toEqual(false)
})
