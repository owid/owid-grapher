import { GrapherInterface } from "@ourworldindata/types"
import * as _ from "lodash-es"
import {
    excludeUndefined,
    omitUndefinedValuesRecursive,
    omitEmptyObjectsRecursive,
    traverseObjects,
} from "./Util"

const REQUIRED_KEYS = ["$schema", "dimensions"]

const KEYS_EXCLUDED_FROM_INHERITANCE = [
    "$schema",
    "id",
    "slug",
    "version",
    "isPublished",
]

/**
 * Simple merge function that doesn't do any Grapher-specific checks.
 *
 * You usually want to use `mergeGrapherConfigs` instead that implements the
 * inheritance model correctly. Only use this if you're sure this is what you need.
 */
export function simpleMerge(
    ...grapherConfigs: GrapherInterface[]
): GrapherInterface {
    return _.mergeWith(
        {}, // mergeWith mutates the first argument
        ...grapherConfigs,
        (_: unknown, childValue: unknown): any => {
            // don't concat arrays, just use the last one
            if (Array.isArray(childValue)) {
                return childValue
            }
        }
    )
}

export function mergeGrapherConfigs(
    ...grapherConfigs: GrapherInterface[]
): GrapherInterface {
    const configsToMerge = grapherConfigs.filter((c) => !_.isEmpty(c))

    // return early if there are no configs to merge
    if (configsToMerge.length === 0) return {}
    if (configsToMerge.length === 1) return configsToMerge[0]

    // warn if one of the configs is missing a schema version
    const configsWithoutSchema = configsToMerge.filter(
        (c) => c["$schema"] === undefined
    )
    if (configsWithoutSchema.length > 0) {
        const configsJson = JSON.stringify(configsWithoutSchema, null, 2)
        console.warn(
            `About to merge Grapher configs with missing schema information: ${configsJson}`
        )
    }

    // abort if the grapher configs have different schema versions
    const uniqueSchemas = _.uniq(
        excludeUndefined(configsToMerge.map((c) => c["$schema"]))
    )
    if (uniqueSchemas.length > 1) {
        throw new Error(
            `Can't merge Grapher configs with different schema versions: ${uniqueSchemas.join(
                ", "
            )}`
        )
    }

    // keys that should not be inherited are removed from all but the last config
    const cleanedConfigs = configsToMerge.map((config, index) => {
        if (index === configsToMerge.length - 1) return config
        return _.omit(config, KEYS_EXCLUDED_FROM_INHERITANCE)
    })

    return simpleMerge(...cleanedConfigs)
}

export function diffGrapherConfigs(
    config: GrapherInterface,
    reference: GrapherInterface
): GrapherInterface {
    const keepKeys = [...REQUIRED_KEYS, ...KEYS_EXCLUDED_FROM_INHERITANCE]
    const keep = _.pick(config, keepKeys)

    const diffed = omitEmptyObjectsRecursive(
        omitUndefinedValuesRecursive(
            traverseObjects(config, reference, (value, refValue) => {
                if (refValue === undefined) return value
                if (!_.isEqual(value, refValue)) return value
                return undefined
            })
        )
    )

    return { ...diffed, ...keep }
}
