import * as fs from "fs-extra"
import * as path from "path"

import parseArgs from "minimist"
import _ from "lodash"

enum EditorOption {
    textfield = "textfield",
    textarea = "textarea",
    dropdown = "dropdown",
    numeric = "numeric",
    checkbox = "checkbox",
    colorEditor = "colorEditor",
    mappingEditor = "mappingEditor",
    primitiveListEditor = "primitiveListEditor",
}

interface FieldDescription {
    pointer: string // JSON Pointer to this field
    type: string
    default?: string
    editor: EditorOption
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

function isPlainTypeOrArrayOfPlainType(type: any) {
    return (
        isPlainTypeString(type) ||
        (_.isArray(type) && _.every(type, isPlainTypeStringOrNull))
    )
}
function isPlainTypeStringOrNull(item: string) {
    return isPlainTypeString(item) || item === "null"
}

function getEditorOptionForType(
    type: string,
    enumOptions: string[] | undefined
): EditorOption {
    if (type === "number") return EditorOption.numeric
    else if (type === "string" && enumOptions) return EditorOption.dropdown
    else if (type === "string") return EditorOption.textfield
    else if (type === "boolean") return EditorOption.checkbox
    else if (type === "integer") return EditorOption.numeric
    else return EditorOption.textfield
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
    pointer: string,
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
        console.log("shouldn't come here?", pointer)
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
                const newPath = `${pointer}/${key}`
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
                pointer: pointer,
                default: schema.default,
                editor: EditorOption.mappingEditor,
                enumOptions: schema.enum,
            })
        } else if (schema.type === "array") {
            // If an array contains only primitive values then we want to
            // edit this in one editor session and then replace the entire
            // array
            if (isPlainTypeOrArrayOfPlainType(schema.items.type)) {
                items.push({
                    type: schema.type,
                    pointer: pointer,
                    default: schema.default,
                    editor: EditorOption.primitiveListEditor,
                    enumOptions: schema.enum,
                })
            }
            // If the array contains an object then things are more complicated -
            // for dimension we have a special case where it only makes sense to
            // talk about a single dimension. For now if we have an object we
            // set the json pointer to the first element and
            else {
                const newPath = `${pointer}/0`
                extractSchema(schema.items, newPath, items)
            }
        } else if (isPlainTypeOrArrayOfPlainType(schema.type)) {
            // If the object describes a primitive type or is
            // an array of only primitive types or null (e.g.
            // because the type is ["string", "null"]) then
            // we yield a single element
            items.push({
                type: schema.type,
                pointer: pointer,
                default: schema.default,
                editor: getEditorOptionForType(schema.type, schema.enum),
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
                pointer: pointer,
                default: schema.default,
                editor: EditorOption.textfield,
            })
        } else {
            console.log("Unexpected type/object1", [schema, pointer])
        }
    } else {
        console.log("Unexpected type/object2", pointer)
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
    extractSchema(dereferenced, "", fields)
    console.log(JSON.stringify(fields, undefined, 2))
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (parsedArgs["h"]) {
    console.log(`schemaProcessor.js - extract schema info`)
} else {
    main(parsedArgs)
}
