#! /usr/bin/env jest

import { MultiDimDataPageConfig } from "./MultiDimDataPageConfig.js"
import YAML from "yaml"

it("fromObject", () => {
    const config = MultiDimDataPageConfig.fromObject({ name: "Test" } as any)
    expect(config.config.name).toBe("Test")
})

describe("methods", () => {
    const yaml = `
    name: CO₂ emissions
    dimensions_title: by fuel type and sector
    common_indicator_path_prefix: gcp/2024/co2_and_ghg_emissions/ # optional
    dimensions:
        - slug: fuel_type
          name: Fuel type
          description: The fuel where these emissions stem from. # optional
          multi_select: true # optional
          choices:
              - slug: gas
                name: Natural gas
                description: Natural gas, e.g. methane or propane.
              - slug: cement
                name: Cement
                description: Emissions from the drying-out of cement.
              - slug: all
                name: All
                description: Emissions from all fuel types.
                multi_select: false
        - slug: sector
          name: Sector
          description: The sector where these emissions stem from.
          choices:
              - slug: agriculture
                name: Agriculture
                description: Agricultural emissions, e.g. from land use change and emissions from livestock and harvesting.
              - slug: transport
                name: Transportation
                description: Emissions from global transport, including cars, trucks, rail transport and global shipping.
              - slug: industry
                name: Industry
                description: Emissions from the production of non-agricultural goods, e.g. steel and glass.
              - slug: heating
              - slug: electricity
    views:
        - dimensions:
              fuel_type: gas
              sector: transport
          indicators:
              emissions__gas__transport: y
          config:
              title: Natural gas emissions in transport
        - dimensions:
              fuel_type: oil
              sector: transport
          indicators:
              emissions__oil__transport: y
          config:
              title: Oil emissions in transport
              subtitle: ...
        - dimensions: # This dimension uses other fields; they probably are nicer to work with
              fuel_type: solar
              sector: electricity
          indicators:
              emissions__solar__transport: y
          config:
              title: ...
              subtitle: ...
`
    const config = MultiDimDataPageConfig.fromObject(YAML.parse(yaml))

    it("dimensions", () => {
        expect(Object.keys(config.dimensions)).toEqual(["fuel_type", "sector"])
        expect(Object.keys(config.dimensions["fuel_type"].choices)).toEqual([
            "gas",
            "cement",
            "all",
        ])
    })

    it("filterViewsByDimensions", () => {
        const views = config.filterViewsByDimensions({
            sector: "transport",
        })
        expect(views).toHaveLength(2)
        expect(views.map((v) => v.config?.title)).toEqual([
            "Natural gas emissions in transport",
            "Oil emissions in transport",
        ])
    })

    it("findViewByDimensions", () => {
        const view = config.findViewByDimensions({
            fuel_type: "gas",
            sector: "transport",
        })
        expect(view).toBeDefined()
    })
})
