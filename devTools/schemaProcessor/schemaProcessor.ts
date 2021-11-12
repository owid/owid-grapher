import * as fs from "fs-extra"
import * as path from "path"

import parseArgs from "minimist"
import _ from "lodash"

interface FieldDescription {
    path: string
    type: string
    default?: string
    needsSpecialEditor: boolean
    enumOptions?: string[]
}

function isPlainTypeString(item: string) {
    return (
        item === "number" ||
        item === "string" ||
        item === "boolean" ||
        item === "integer"
    )
}

function isPlainTypeStringOrNull(item: string) {
    return isPlainTypeString(item) || item === "null"
}

function extractSchema(schema: any, path: string, items: FieldDescription[]) {
    // for primitives we have nothing to do
    if (
        _.isNull(schema) ||
        _.isUndefined(schema) ||
        _.isNumber(schema) ||
        _.isString(schema) ||
        _.isBoolean(schema) ||
        _.isArray(schema)
    ) {
        console.log("shouldn't come here?", path)
        return
    } else if (_.isPlainObject(schema)) {
        if (
            schema.hasOwnProperty("type") &&
            schema.type === "object" &&
            schema.hasOwnProperty("properties")
        ) {
            for (const key of _.keys(schema.properties)) {
                const newPath = `${path}.${key}`
                extractSchema(schema.properties[key], newPath, items)
            }
        } else if (
            schema.hasOwnProperty("type") &&
            schema.type === "object" &&
            schema.hasOwnProperty("patternProperties") &&
            _.every(
                Object.values(schema.patternProperties),
                (item: any) =>
                    _.isPlainObject(item) &&
                    item.hasOwnProperty("type") &&
                    isPlainTypeString(item.type)
            )
        ) {
            items.push({
                type: schema.type,
                path: path,
                default: schema.default,
                needsSpecialEditor: true,
            })
        } else if (schema.type === "array") {
            // TODO: probably special handling for these
            const newPath = `${path}[*]`
            extractSchema(schema.items, newPath, items)
        } else if (
            isPlainTypeString(schema.type) ||
            (_.isArray(schema.type) &&
                _.every(schema.type, isPlainTypeStringOrNull))
        ) {
            items.push({
                type: schema.type,
                path: path,
                default: schema.default,
                needsSpecialEditor: false,
            })
        } else if (
            schema.hasOwnProperty("oneOf") &&
            _.isArray(schema.oneOf) &&
            _.every(
                _.map(schema.oneOf, (item) => item.type),
                isPlainTypeStringOrNull
            )
        ) {
            const types = schema.oneOf.map((item: any) => item.type)
            items.push({
                type: types,
                path: path,
                default: schema.default,
                needsSpecialEditor: false,
            })
        } else {
            console.log("Unexpected type/object1", [schema, path])
        }
    } else {
        console.log("Unexpected type/object2", path)
    }
}

function objectMap(object: any, mapFn: (result: any) => any) {
    return Object.keys(object).reduce(function (result: any, key) {
        result[key] = mapFn(object[key])
        return result
    }, {})
}

function recursiveDereference(schema: any, defs: any): any {
    if (schema !== null && schema !== undefined && _.isPlainObject(schema)) {
        if (schema.hasOwnProperty("$ref")) {
            const ref = schema["$ref"]
            const localPrefix = "#/$defs/"
            if (!ref.startsWith(localPrefix))
                throw "Only local refs are supported at the moment!"
            const refName = ref.substring(localPrefix.length)
            if (!defs.hasOwnProperty(refName)) {
                console.error("Reference not found", refName)
                return schema
            } else return defs[refName] // Note: we are not using recursive dereferencing, i.e. if there are refs in the $defs section we don't resolve them here
        } else {
            return objectMap(schema, (val) => recursiveDereference(val, defs))
        }
    } else return schema
}

function dereference(schema: any) {
    if (schema === null || schema === undefined || !_.isPlainObject(schema)) {
        throw "Schema was not an object!"
    } else {
        if (!schema.hasOwnProperty("$defs")) return
        const defs = schema["$defs"]

        const dereferenced = recursiveDereference(schema, defs)
        const newSchema = _.omit(dereferenced, ["$defs"])
        return newSchema
    }
}

async function main(parsedArgs: parseArgs.ParsedArgs) {
    const schema = await fs.readJson("schema.json")
    const dereferenced = dereference(schema)
    const fields: FieldDescription[] = []
    extractSchema(dereferenced, "$", fields)
    for (const field of fields) console.log(JSON.stringify(field, undefined, 0))
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"]) {
    console.log(`schemaProcessor.js - extract schema info`)
} else {
    main(parsedArgs)
}
