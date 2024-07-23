import { GrapherInterface } from "@ourworldindata/types"
import {
    isEqual,
    mergeWith,
    uniq,
    omit,
    pick,
    excludeUndefined,
    omitUndefinedValuesRecursive,
    omitEmptyObjectsRecursive,
    traverseObjects,
} from "./Util"

const KEYS_EXCLUDED_FROM_INHERITANCE = [
    "$schema",
    "id",
    "slug",
    "version",
    "isPublished",
]

export function mergeGrapherConfigs(
    ...grapherConfigs: GrapherInterface[]
): GrapherInterface {
    // warn if one of the configs is missing a schema version
    const configsWithoutSchema = grapherConfigs.filter(
        (c) => c["$schema"] === undefined
    )
    if (configsWithoutSchema.length > 0) {
        const ids = configsWithoutSchema.map((c) => c.id)
        console.warn(
            `About to merge Grapher configs with missing schema information. Charts with missing schema information: ${ids}`
        )
    }

    // abort if the grapher configs have different schema versions
    const uniqueSchemas = uniq(
        excludeUndefined(grapherConfigs.map((c) => c["$schema"]))
    )
    if (uniqueSchemas.length > 1) {
        throw new Error(
            `Can't merge Grapher configs with different schema versions: ${uniqueSchemas.join(
                ", "
            )}`
        )
    }

    // keys that should not be inherited are removed from all but the last config
    const cleanedConfigs = grapherConfigs.map((config, index) => {
        if (index === grapherConfigs.length - 1) return config
        return omit(config, KEYS_EXCLUDED_FROM_INHERITANCE)
    })

    return mergeWith(
        {}, // mergeWith mutates the first argument
        ...cleanedConfigs,
        (_: unknown, childValue: unknown): any => {
            // don't concat arrays, just use the last one
            if (Array.isArray(childValue)) {
                return childValue
            }
        }
    )
}

export function diffGrapherConfigs(
    config: GrapherInterface,
    reference: GrapherInterface
): GrapherInterface {
    const keep = pick(config, KEYS_EXCLUDED_FROM_INHERITANCE)

    const diffed = omitEmptyObjectsRecursive(
        omitUndefinedValuesRecursive(
            traverseObjects(config, reference, (value, refValue) => {
                if (refValue === undefined) return value
                if (!isEqual(value, refValue)) return value
                return undefined
            })
        )
    )

    return { ...diffed, ...keep }
}
