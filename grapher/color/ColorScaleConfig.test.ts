#! /usr/bin/env jest

import { ColorScaleConfig } from "./ColorScaleConfig"

it("can serialize for saving", () => {
    expect(new ColorScaleConfig().toObject()).toEqual({})
})
