import * as _ from "lodash-es"
import jsonpointer from "json8-pointer"
import { GrapherConfigPatch } from "./AdminSessionTypes.js"
import { checkIsStringIndexable } from "@ourworldindata/utils"
import * as R from "remeda"

export function setValueRecursiveInplace(
    json: unknown,
    pointer: string[],
    newValue: unknown
): any {
    if (pointer.length === 0) throw new Error("Pointer must not be empty")

    const key: string = pointer[0]
    pointer = pointer.slice(1)
    const currentPartAsNumber = Number.parseInt(key)
    if (json === undefined) {
        if (!isNaN(currentPartAsNumber)) {
            json = []
        } else {
            json = {}
        }
    }
    if (pointer.length === 0) {
        if (_.isArray(json) && !isNaN(currentPartAsNumber)) {
            if (json.length > currentPartAsNumber)
                json[currentPartAsNumber] = newValue
            else json.push(newValue)
        } else (json as Record<string, unknown>)[key] = newValue

        return json
    }

    if (checkIsStringIndexable(json)) {
        if (json[key] === undefined) {
            // because we work in-place, we need to create the missing child element before recursing
            const nextPartAsNumber = Number.parseInt(pointer[0])
            if (!isNaN(nextPartAsNumber)) {
                json[key] = []
            } else {
                json[key] = {}
            }
        }
    }

    return setValueRecursiveInplace(
        (json as Record<string, unknown>)[key],
        pointer,
        newValue
    )
}

export function setValueRecursive(
    json: unknown,
    pointer: string[],
    newValue: unknown
): any {
    // If the pointer is empty at this recursion level then just return newValue
    if (pointer.length === 0) {
        return newValue
    } else {
        // We check if the currently relevant part of the pointer is a number or a string
        const currentPart = pointer[0]
        const currentPartAsNumber = Number.parseInt(currentPart)
        if (Number.isNaN(currentPartAsNumber)) {
            // If we have a string then recurse into the object
            let newObject: any = {}
            if (json !== undefined && R.isPlainObject(json))
                newObject = { ...json }
            const currentValue = Object.prototype.hasOwnProperty.call(
                newObject,
                currentPart
            )
                ? newObject[currentPart]
                : undefined
            const updatedValue = setValueRecursive(
                currentValue,
                pointer.slice(1),
                newValue
            )
            // if we got a null back as the result of the update operation
            // then delete the key, otherwise set the property to the updated value
            if (updatedValue === null) delete newObject[currentPart]
            else newObject[currentPart] = updatedValue
            return newObject
        } else {
            // we have a number as a key. Either there is already an array at this place
            // and we should update or append it or we need to create a new array (else branch below)
            if (R.isArray(json)) {
                const newArray = [...json]
                const oldValue =
                    currentPartAsNumber < newArray.length
                        ? newArray[currentPartAsNumber]
                        : undefined
                const updatedValue = setValueRecursive(
                    oldValue,
                    pointer.slice(1),
                    newValue
                )
                if (updatedValue === null) {
                    // if the updated value is null then remove this item
                    //   if this is a valid index, splice it out
                    if (currentPartAsNumber < newArray.length) {
                        newArray.splice(currentPartAsNumber, 1)
                    }
                    // otherwise ignore it since it is not in the array yet anyhow
                } else {
                    if (currentPartAsNumber < newArray.length) {
                        newArray[currentPartAsNumber] = updatedValue
                    } else newArray.push(updatedValue)
                }
                return newArray
            } else {
                // if we have a number as key but no array at the current position, then we need to create a new array.
                // If the value is nested inside we still need to create the correct substructure inside the new array, so
                // recurse but with null as the current json value to create the nested substructure
                const updatedValue = setValueRecursive(
                    null,
                    pointer.slice(1),
                    newValue
                )
                if (_.isNil(updatedValue)) return null
                else return [updatedValue]
            }
        }
    }
}

export function compileGetValueFunction(jsonPointer: string): (x: any) => any {
    // TODO: the json8-pointer libarary compile function does not return undefined
    // if the item can't be found like find but instead throws. Probably it makes sense
    // to try to create a more efficient version here that does not throw exceptions since
    // this will be used very often in an inner loop
    return (input): any => jsonpointer.find(input, jsonPointer)
}

export function applyPatch(patchSet: GrapherConfigPatch, config: unknown): any {
    const pointer = jsonpointer.parse(patchSet.jsonPointer) as string[]

    if (pointer.length === 0) throw Error("Empty JSON path is not supported")
    if (
        config !== undefined &&
        config !== null &&
        !(R.isArray(config) || R.isPlainObject(config))
    ) {
        throw Error(
            "When given an non-empty pointer, config must be either an object or array but it is " +
                typeof config
        )
    }

    const currentValue = jsonpointer.find(config, patchSet.jsonPointer)
    const currentIsOld = _.isEqual(currentValue, patchSet.oldValue)
    const currentIsOldOrAllowedNull =
        currentIsOld ||
        (patchSet.oldValueIsEquivalentToNullOrUndefined &&
            _.isNil(currentValue))

    // The case below is when we don't want to set a new value and the old json deserialized value is null. In
    // this case the equality is false but logically we are fine with this of course
    const currentIsUndefinedOldIsNull =
        currentValue === undefined && patchSet.oldValue === null

    if (!currentIsOldOrAllowedNull && !currentIsUndefinedOldIsNull) {
        console.warn(
            `When trying to set value for %d at %s the existing value was not as expected (showing current and expected)`,
            patchSet.id,
            patchSet.jsonPointer,
            currentValue,
            patchSet.oldValue
        )
        throw Error("Old value was not as expected")
    }

    const newConfig = setValueRecursive(config, pointer, patchSet.newValue)
    return newConfig
}
