import fs from "fs-extra"
import YAML from "yaml"
import { MultiDimDataPageConfigType, View } from "./MultiDimDataPageTypes.js"
import { DimensionProperty, keyBy } from "@ourworldindata/utils"

export class MultiDimDataPageConfig {
    private constructor(public readonly config: MultiDimDataPageConfigType) {}

    static fromYaml(yaml: string) {
        return new MultiDimDataPageConfig(YAML.parse(yaml))
    }

    static fromObject(obj: MultiDimDataPageConfigType) {
        return new MultiDimDataPageConfig(obj)
    }

    get dimensions() {
        const dimensionsWithChoicesBySlug = this.config.dimensions.map(
            (dimension) => ({
                ...dimension,
                choices: keyBy(dimension.choices, "slug"),
            })
        )
        return keyBy(dimensionsWithChoicesBySlug, "slug")
    }

    filterViewsByDimensions(dimensions: Record<string, string>): View[] {
        return this.config.views.filter((view) => {
            for (const [dimensionSlug, choiceSlug] of Object.entries(
                dimensions
            )) {
                if (view.dimensions[dimensionSlug] !== choiceSlug) return false
            }
            return true
        })
    }

    findViewByDimensions(dimensions: Record<string, string>) {
        const matchingViews = this.filterViewsByDimensions(dimensions)
        if (matchingViews.length === 0) return undefined
        if (matchingViews.length > 1) {
            throw new Error(
                `Multiple views found for dimensions ${JSON.stringify(
                    dimensions
                )}`
            )
        }
        return matchingViews[0]
    }

    static transformIndicatorPathObj(
        indicatorPathObj: Record<string, DimensionProperty>
    ): Record<DimensionProperty, string[]> {
        const emptyObj: Record<DimensionProperty, string[]> = {
            x: [],
            y: [],
            color: [],
            size: [],
            table: [],
        }
        return Object.entries(indicatorPathObj).reduce(
            (result, [indicatorPath, dimension]) => {
                result[dimension].push(indicatorPath)
                return result
            },
            emptyObj
        )
    }
}

export const MULTI_DIM_DATA_PAGE_CONFIG = MultiDimDataPageConfig.fromYaml(
    `
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
      indicator_path:
          emissions__gas__transport: y
      config:
          title: Natural gas emissions in transport
    - dimensions:
          fuel_type: oil
          sector: transport
      indicator_path:
          emissions__oil__transport: y
      config:
          title: Oil emissions in transport
          subtitle: ...
    - dimensions: # This dimension uses other fields; they probably are nicer to work with
          fuel_type: solar
          sector: electricity
      indicator_path:
          emissions__solar__transport: y
      config:
          title: ...
          subtitle: ...

`
)
