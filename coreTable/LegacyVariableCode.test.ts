#! /usr/bin/env yarn jest

import { LegacyVariableDisplayConfig } from "./LegacyVariableCode"

it("can create and save display settings", () => {
    const settings = new LegacyVariableDisplayConfig()
    expect(settings.toObject()).toEqual({})

    settings.shortUnit = "kwh"
    expect(settings.toObject()).toEqual({ shortUnit: "kwh" })
})
