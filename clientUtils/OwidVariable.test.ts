#! /usr/bin/env jest

import { OwidVariableDisplayConfig } from "./OwidVariable.js"

it("can create and save display settings", () => {
    const settings = new OwidVariableDisplayConfig()
    expect(settings.toObject()).toEqual({})

    settings.shortUnit = "kwh"
    expect(settings.toObject()).toEqual({ shortUnit: "kwh" })
})
