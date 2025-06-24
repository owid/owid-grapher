import * as _ from "lodash-es"
import { compileGetValueFunction } from "./patchHelper.js"
import * as R from "remeda"

export enum EditorOption {
    textfield = "textfield",
    textarea = "textarea",
    dropdown = "dropdown",
    numeric = "numeric",
    numericWithLatestEarliest = "numericWithLatestEarliest",
    checkbox = "checkbox",
    colorEditor = "colorEditor",
    mappingEditor = "mappingEditor",
    primitiveListEditor = "primitiveListEditor",
}

export enum FieldType {
    number = "number",
    string = "string",
    boolean = "boolean",
    integer = "integer",
    complex = "complex",
}

export interface FieldDescription {
    pointer: string // JSON Pointer to this field
    getter: (target: Record<string, unknown>) => any
    type: FieldType | FieldType[]
    default?: string
    editor: EditorOption
    enumOptions?: string[]
    description: string
}

function isPlainTypeString(item: string): item is FieldType {
    return (
        item === "number" ||
        item === "string" ||
        item === "boolean" ||
        item === "integer"
    )
}

function isPlainTypeOrArrayOfPlainType(type: any): boolean {
    return (
        isPlainTypeString(type) ||
        (_.isArray(type) && type.every(isPlainTypeStringOrNull))
    )
}
function isPlainTypeStringOrNull(item: string): boolean {
    return isPlainTypeString(item) || item === "null"
}

function typeIsGivenOrNull(
    typeToTest: string | string[],
    type: string
): boolean {
    // We often have a type that is an array of a given type and null. This helper
    // function returns true if the type is exactly the given type or an array of this and null
    if (typeof typeToTest === "string") return typeToTest === type
    return typeToTest.every((item) => item === type || item === "null")
}

function getEditorOptionForType(
    type: string | string[],
    enumOptions: string[] | undefined
): EditorOption {
    if (typeIsGivenOrNull(type, "number")) return EditorOption.numeric
    else if (typeIsGivenOrNull(type, "string") && enumOptions)
        return EditorOption.dropdown
    else if (typeIsGivenOrNull(type, "string")) return EditorOption.textfield
    else if (typeIsGivenOrNull(type, "boolean")) return EditorOption.checkbox
    else if (typeIsGivenOrNull(type, "integer")) return EditorOption.numeric
    else if (_.isArray(type)) {
        // the following line is aspecial case hack for fields that are usually numeric but can have a
        // special string like "latest"
        if (type[0] === "number" && type[1] === "string")
            return EditorOption.numericWithLatestEarliest
        else return EditorOption.textfield
    } else if (type === "array") return EditorOption.primitiveListEditor
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
function extractSchemaRecursive(
    schema: unknown,
    pointer: string,
    items: FieldDescription[]
): void {
    // We shouldn't encounter primitives in the schema itself (since we recurse
    // only into expected structures which are almost always objects)
    if (
        schema === null ||
        schema === undefined ||
        R.isNumber(schema) ||
        R.isString(schema) ||
        R.isBoolean(schema) ||
        R.isArray(schema)
    ) {
        console.error("shouldn't come here?", pointer)
        return
    } else if (R.isPlainObject(schema)) {
        // If the current schema fragment describes a normal object
        // then do not emit anything directly and recurse over the
        // described properties
        if (
            Object.prototype.hasOwnProperty.call(schema, "type") &&
            schema.type === "object" &&
            Object.prototype.hasOwnProperty.call(schema, "properties") &&
            R.isPlainObject(schema.properties)
        ) {
            // Color scales are complex objects that are treated as opaque objects with a special
            // rich editor. We identify them by the property they are stored as. If we have a color
            // scale, push a single FieldDescription for it with the editor set accordingly.
            // Otherwise we have a normal object and we recurse.
            if (pointer.endsWith("colorScale")) {
                items.push({
                    type: FieldType.complex,
                    getter: compileGetValueFunction(pointer),
                    pointer: pointer,
                    default: undefined,
                    editor: EditorOption.colorEditor,
                    enumOptions: undefined,
                    description:
                        (schema.description as string | undefined) ?? "",
                })
            } else
                for (const key of Object.keys(schema.properties)) {
                    const newPath = `${pointer}/${key}`
                    extractSchemaRecursive(
                        (schema.properties as Record<string, unknown>)[key],
                        newPath,
                        items
                    )
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
            Object.prototype.hasOwnProperty.call(schema, "type") &&
            schema.type === "object" &&
            Object.prototype.hasOwnProperty.call(schema, "patternProperties") &&
            Object.values(
                schema.patternProperties as Record<string, any>
            ).every(
                (item: any) =>
                    R.isPlainObject(item) &&
                    Object.prototype.hasOwnProperty.call(item, "type") &&
                    isPlainTypeString((item as any).type)
            )
        ) {
            items.push({
                type: schema.type as FieldType,
                getter: compileGetValueFunction(pointer),
                pointer: pointer,
                default: schema.default as string | undefined,
                editor: EditorOption.mappingEditor,
                enumOptions: schema.enum as string[] | undefined,
                description: (schema.description as string | undefined) ?? "",
            })
        } else if (schema.type === "array") {
            // If an array contains only primitive values then we want to
            // edit this in one editor session and then replace the entire
            // array
            if (isPlainTypeOrArrayOfPlainType((schema as any).items.type)) {
                items.push({
                    type: schema.type as FieldType | FieldType[],
                    getter: compileGetValueFunction(pointer),
                    pointer: pointer,
                    default: schema.default as string | undefined,
                    editor: EditorOption.primitiveListEditor,
                    enumOptions: schema.enum as string[] | undefined,
                    description:
                        (schema.description as string | undefined) ?? "",
                })
            }
            // If the array contains an object then things are more complicated -
            // for dimension we have a special case where it only makes sense to
            // talk about a single dimension. For now if we have an object we
            // set the json pointer to the first element and
            else {
                const newPath = `${pointer}/0`
                extractSchemaRecursive(schema.items, newPath, items)
            }
        } else if (isPlainTypeOrArrayOfPlainType(schema.type)) {
            // If the object describes a primitive type or is
            // an array of only primitive types or null (e.g.
            // because the type is ["string", "null"]) then
            // we yield a single element
            items.push({
                type: schema.type as FieldType | FieldType[],
                getter: compileGetValueFunction(pointer),
                pointer: pointer,
                default: schema.default as string | undefined,
                editor: getEditorOptionForType(
                    schema.type as string | string[],
                    schema.enum as string[] | undefined
                ),
                enumOptions: schema.enum as string[] | undefined,
                description: (schema.description as string | undefined) ?? "",
            })
        } else if (
            // If we have a oneOf description then we need to
            // check if all of the cases have a type field with
            // a primitive type. If so we collect all the types
            // and yield a single FieldDefinition with the merged
            // type
            Object.prototype.hasOwnProperty.call(schema, "oneOf") &&
            _.isArray(schema.oneOf) &&
            schema.oneOf.map((item) => item.type).every(isPlainTypeStringOrNull)
        ) {
            const types = schema.oneOf.map((item: any) => item.type)
            items.push({
                type: types as FieldType | FieldType[],
                getter: compileGetValueFunction(pointer),
                pointer: pointer,
                default: schema.default as string | undefined,
                editor: getEditorOptionForType(types, undefined),
                description: (schema.description as string | undefined) ?? "",
            })
        } else {
            console.error("Unexpected type/object", [schema, pointer])
        }
    } else {
        console.error("Unexpected type/object", pointer)
    }
}

function recursiveDereference(
    schema: unknown,
    defs: Record<string, unknown>
): any {
    if (schema !== null && schema !== undefined && R.isPlainObject(schema)) {
        if (Object.prototype.hasOwnProperty.call(schema, "$ref")) {
            const ref = schema["$ref"] as string
            const localPrefix = "#/$defs/"
            if (!ref.startsWith(localPrefix))
                throw "Only local refs are supported at the moment!"
            const refName = ref.substring(localPrefix.length)
            if (!Object.prototype.hasOwnProperty.call(defs, refName)) {
                console.error("Reference not found", refName)
                return schema
            } else return defs[refName] // Note: we are not using recursive dereferencing, i.e. if there are refs in the $defs section we don't resolve them here
        } else {
            return _.mapValues(schema, (val) => recursiveDereference(val, defs))
        }
    } else return schema
}

function dereference(schema: Record<string, unknown>): any {
    if (!Object.prototype.hasOwnProperty.call(schema, "$defs")) return
    const defs = schema["$defs"] as Record<string, unknown>

    const dereferenced = recursiveDereference(schema, defs)
    const newSchema = _.omit(dereferenced, ["$defs"])
    return newSchema
}

export function extractFieldDescriptionsFromSchema(
    schema: unknown
): FieldDescription[] {
    if (R.isPlainObject(schema)) {
        const dereferenced = dereference(schema)
        const fieldDescriptions: FieldDescription[] = []
        extractSchemaRecursive(dereferenced, "", fieldDescriptions)
        return fieldDescriptions
    } else throw new Error("Schema was not an object!")
}
