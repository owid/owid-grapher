import YAML from "yaml"
import { MultiDimDataPageConfigType, View } from "./MultiDimDataPageTypes.js"
import { DimensionProperty, keyBy } from "@ourworldindata/utils"
import config from "./config.json"

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

export const MULTI_DIM_DATA_PAGE_CONFIG = MultiDimDataPageConfig.fromObject(
    config as any as MultiDimDataPageConfigType
)
