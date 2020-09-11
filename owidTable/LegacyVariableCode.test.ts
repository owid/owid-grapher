#! /usr/bin/env yarn jest

import { PersistableLegacyVariableDisplaySettings } from "./LegacyVariableCode"

describe("display settings", () => {
    it("can create and save display settings", () => {
        const settings = new PersistableLegacyVariableDisplaySettings()
        expect(settings.toObject()).toEqual({})

        settings.shortUnit = "kwh"
        expect(settings.toObject()).toEqual({ shortUnit: "kwh" })
    })
})
