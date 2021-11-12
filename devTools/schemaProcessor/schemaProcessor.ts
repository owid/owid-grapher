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

/** This function takes a json schema that has been read and converted from json to a
    JS object and processes it into a list of FieldDescriptions. A FieldDescription
    contains just the information we will need for creating the columns for the Bulk FASTT
    editor.

    On a high level, what we do here is walk the recursive document structure of the json
    schema and look at every level. If a property "type" exists and it is object then we
    want to recurse over the properties (we are usually only interested in properties in
    leaf position in the object graph because these are the ones we want to map to a single
    spreadsheet cell). If the type is a primitive then we just create a FieldDescription entry.

    There are some complications, for example:
        * type can be an array to express a union of null | string
        * anyof creates a fork that has to be combined into a single entry
 *
 */
function extractSchema(
    schema: any,
    path: string,
    items: FieldDescription[]
): void {
    // We shouldn't encounter primitives in the schema itself (since we recurse
    // only into expected structures which are almost always objects)
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
        // If the current schema fragment describes a normal object
        // then do not emit anything directly and recurse over the
        // described properties
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
            // if we have an object that uses patternProperties to
            // describe arbitrary properties then we special case
            // if all such properties are of primitive type. In our
            // schema we use such constructs for mapping arbitrary
            // country names to colors for example where the
            // paternProperties is ".*" and the type of those
            // is string (interpreted as a color)
            // We yield something like this as a single entry
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
                enumOptions: schema.enum,
            })
        } else if (schema.type === "array") {
            // For now if we have an array we add "[*]" to the path
            // and recurse on the items. Since we want to write arrays
            // as one go we will probably change this soon
            const newPath = `${path}[*]`
            extractSchema(schema.items, newPath, items)
        } else if (
            isPlainTypeString(schema.type) ||
            (_.isArray(schema.type) &&
                _.every(schema.type, isPlainTypeStringOrNull))
        ) {
            // If the object describes a primitive type or is
            // an array of only primitive types or null (e.g.
            // because the type is ["string", "null"]) then
            // we yield a single element
            items.push({
                type: schema.type,
                path: path,
                default: schema.default,
                needsSpecialEditor: false,
                enumOptions: schema.enum,
            })
        } else if (
            // If we have a oneOf description then we need to
            // check if all of the cases have a type field with
            // a primitive type. If so we collect all the types
            // and yield a single FieldDefinition with the merged
            // type
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
