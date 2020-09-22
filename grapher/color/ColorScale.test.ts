#! /usr/bin/env yarn jest

import { ColorScale } from "./ColorScale"
import { ColorScaleConfig } from "./ColorScaleConfig"

describe(ColorScale, () => {
    it("can create one", () => {
        const colorScaleConfig = new ColorScaleConfig()
        const scale = new ColorScale({
            hasNoDataBin: false,
            categoricalValues: [],
            colorScaleConfig,
        })
        expect(scale.isColorSchemeInverted).toEqual(false)
    })
})
