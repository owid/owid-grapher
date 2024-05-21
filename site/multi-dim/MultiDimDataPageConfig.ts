import YAML from "yaml"
import {
    Dimension,
    MultiDimDataPageConfigType,
    View,
} from "./MultiDimDataPageTypes.js"
import { DimensionProperty, groupBy, keyBy } from "@ourworldindata/utils"

export class MultiDimDataPageConfig {
    private constructor(public readonly config: MultiDimDataPageConfigType) {}

    static fromYaml(yaml: string) {
        return new MultiDimDataPageConfig(YAML.parse(yaml))
    }

    static fromObject(obj: MultiDimDataPageConfigType) {
        return new MultiDimDataPageConfig(obj)
    }

    static getChoicesFields(choices: Dimension[]) {
        return {
            choices,
            choicesBySlug: keyBy(choices, "slug"),
            choicesByGroup: groupBy(choices, "group"),
        }
    }

    get dimensions() {
        const dimensionsEnriched = this.config.dimensions.map((dimension) => ({
            ...dimension,
            ...MultiDimDataPageConfig.getChoicesFields(dimension.choices),
        }))
        return keyBy(dimensionsEnriched, "slug")
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

    filterToAvailableChoices(selectedChoices: Record<string, string>) {
        const updatedSelectedChoices: Record<string, string> = {}
        const dimensionsWithAvailableChoices = this.dimensions
        for (const [dimSlug, dim] of Object.entries(
            dimensionsWithAvailableChoices
        )) {
            const availableViewsBeforeSelection = this.filterViewsByDimensions(
                updatedSelectedChoices
            )
            if (
                selectedChoices[dimSlug] &&
                dim.choicesBySlug[selectedChoices[dimSlug]]
            ) {
                updatedSelectedChoices[dimSlug] = selectedChoices[dimSlug]
            } else {
                throw new Error(
                    `Missing or invalid choice for dimension ${dimSlug}`
                )
            }

            const availableViewsAfterSelection = this.filterViewsByDimensions(
                updatedSelectedChoices
            )
            if (availableViewsAfterSelection.length === 0) {
                updatedSelectedChoices[dimSlug] =
                    availableViewsBeforeSelection[0].dimensions[dimSlug]
            }

            const choices = Object.values(dim.choices).filter((choice) =>
                availableViewsBeforeSelection.some(
                    (view) => view.dimensions[dimSlug] === choice.slug
                )
            )

            dimensionsWithAvailableChoices[dimSlug] = {
                ...dim,
                ...MultiDimDataPageConfig.getChoicesFields(choices),
            }
        }

        return {
            selectedChoices: updatedSelectedChoices,
            dimensionsWithAvailableChoices,
        }
    }

    static transformIndicatorPathObj(
        indicatorPathObj:
            | Record<string, DimensionProperty>
            | Array<Record<string, DimensionProperty>>
    ): Record<DimensionProperty, string[]> {
        const emptyObj: Record<DimensionProperty, string[]> = {
            x: [],
            y: [],
            color: [],
            size: [],
            table: [],
        }
        if (Array.isArray(indicatorPathObj)) {
            return indicatorPathObj.reduce((result, obj) => {
                const transformed =
                    MultiDimDataPageConfig.transformIndicatorPathObj(obj)
                for (const [dimension, indicatorPaths] of Object.entries(
                    transformed
                )) {
                    result[dimension as DimensionProperty].push(
                        ...indicatorPaths
                    )
                }
                return result
            }, emptyObj)
        } else {
            return Object.entries(indicatorPathObj).reduce(
                (result, [indicatorPath, dimension]) => {
                    result[dimension].push(indicatorPath)
                    return result
                },
                emptyObj
            )
        }
    }
}
