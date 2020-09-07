import { mapKeys } from "grapher/utils/Util"

declare var window: any

/*

FullStory is a bit strict around typing. All keys must have type suffixes, e.g.
"fullName_str" for string, "itemPrices_reals" for array of reals. Arrays can't
have multiple types.

Details: https://help.fullstory.com/develop-js/367098-fs-recording-client-api-requirements##search_query=

*/

const alreadyTyped = /_(strs?|ints?|reals?|dates?|bools?)$/

type ValueType = "str" | "int" | "real" | "bool" | "date" | ""

function getType(value: any): ValueType {
    if (typeof value === "string") return "str"
    if (typeof value === "number") return "real"
    if (typeof value === "boolean") return "bool"
    if (value instanceof Date) return "date"
    else return "" // assume it's nested object
}

function getTypedKey(value: any, key: string): string {
    if (alreadyTyped.test(key)) {
        return key
    } else if (Array.isArray(value)) {
        const allTypes = value.map(getType)
        if (allTypes.some(type => type !== allTypes[0])) {
            throw new Error("All array items must be of same type")
        } else {
            if (allTypes[0]) return `${key}_${allTypes[0]}s`
            else return key
        }
    } else {
        const type = getType(value)
        if (type) return `${key}_${type}`
        else return key
    }
}

// TODO support nested objects
function annotateKeyTypes(obj: { [key: string]: any }) {
    return mapKeys(obj, getTypedKey)
}

export class FullStory {
    static event(name: string, props: { [key: string]: any }) {
        if (!window.FS) return
        try {
            window.FS.event(name, annotateKeyTypes(props))
        } catch (error) {
            console.error(error)
        }
    }
}
