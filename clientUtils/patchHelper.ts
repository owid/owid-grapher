import jsonpointer from "json8-pointer"
import { VariableAnnotationPatch } from "./AdminSessionTypes.js"
import { isArray, isPlainObjectWithGuard } from "./Util.js"
export function setValueRecursive(
    json: any,
    pointer: string[],
    newValue: any
): any {
    // If the pointer is empty at this recursion level then just return newValue
    if (pointer.length == 0) {
        return newValue
    } else {
        // We check if the currently relevant part of the pointer is a number or a string
        const currentPart = pointer[0]
        const currentPartAsNumber = Number.parseInt(currentPart)
        if (Number.isNaN(currentPartAsNumber)) {
            // If we have a string then recurse into the object
            let newObject: any = {}
            if (json !== undefined) newObject = { ...json }
            const currentValue = newObject.hasOwnProperty(currentPart)
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
            if (isArray(json)) {
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
                if (updatedValue == null) return null
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

export function applyPatch(
    patchSet: VariableAnnotationPatch,
    config: unknown
): any {
    const pointer = jsonpointer.parse(patchSet.jsonPointer) as string[]

    if (pointer.length == 0) throw Error("Empty JSON path is not supported")
    if (
        config !== undefined &&
        config !== null &&
        !(isArray(config) || isPlainObjectWithGuard(config))
    ) {
        throw Error(
            "When given an non-empty pointer, config must be either an object or array but it is " +
                typeof config
        )
    }

    const currentValue = jsonpointer.find(config, patchSet.jsonPointer)

    if (
        currentValue !== patchSet.oldValue &&
        !(currentValue === undefined && patchSet.oldValue === null)
    ) {
        console.warn(
            `When trying to set value for ${patchSet.variableId} at ${patchSet.jsonPointer}, the existing value was ${currentValue} instead of ${patchSet.oldValue}`
        )
        throw Error("Old value was not as expected")
    }

    const newConfig = setValueRecursive(config, pointer, patchSet.newValue)
    return newConfig
}
