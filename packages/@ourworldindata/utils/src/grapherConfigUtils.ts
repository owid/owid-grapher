import { GrapherInterface } from "@ourworldindata/types"
import { isEqual, mergeWith, uniq } from "./Util"

export function mergeGrapherConfigs(
    ...grapherConfigs: GrapherInterface[]
): GrapherInterface {
    // abort if the grapher configs have different schema versions
    const uniqueSchemas = uniq(grapherConfigs.map((c) => c["$schema"]))
    if (uniqueSchemas.length > 1) {
        throw new Error(
            `Can't merge grapher configs with different schema versions: ${uniqueSchemas.join(
                ", "
            )}`
        )
    }

    // id, slug, version and isPublished should not be inherited,
    // so we remove them from all but the last config
    const cleanedConfigs = grapherConfigs.map((config, index) => {
        if (index === grapherConfigs.length - 1) return config
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, slug, version, isPublished, ...cleanedConfig } = config
        return cleanedConfig
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

// TODO: types
function traverseObjects<
    T extends Record<string, any>,
    U extends Record<string, any>,
>(
    obj: T,
    ref: U,
    cb: (objValue: unknown, refValue: unknown) => any
): Partial<T> {
    const result: any = {}
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (typeof obj[key] === "object" && obj[key] !== null) {
                result[key] = traverseObjects(obj[key], ref[key], cb)
            } else {
                result[key] = cb(obj[key], ref[key])
            }
        }
    }
    return result
}

// TODO: exclude id, slug, version, isPublished?
export function diffGrapherConfigs(
    config: GrapherInterface,
    reference: GrapherInterface
): GrapherInterface {
    return traverseObjects(config, reference, (value, refValue) => {
        if (refValue === undefined) return value
        if (!isEqual(value, refValue)) return value
        else return undefined
    })
}
