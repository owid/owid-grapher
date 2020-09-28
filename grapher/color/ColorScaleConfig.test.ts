#! /usr/bin/env yarn jest

import { ColorScaleConfig } from "./ColorScaleConfig"

it("can serialize for saving", () => {
    expect(new ColorScaleConfig().toObject()).toEqual({})
})
