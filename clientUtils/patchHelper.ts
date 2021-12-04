import jsonpointer from "json8-pointer"
import { VariableAnnotationPatch } from "./AdminSessionTypes"
import { isArray, isPlainObjectWithGuard } from "./Util"
export function setValueRecursive(
    json: any,
    pointer: string[],
    newValue: any
): any {
    if (pointer.length == 0) {
        return newValue
    } else {
        const currentPart = pointer[0]
        const currentPartAsNumber = Number.parseInt(currentPart)
        if (Number.isNaN(currentPartAsNumber)) {
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
            if (updatedValue === null) delete newObject[currentPart]
            else newObject[currentPart] = updatedValue
            return newObject
        } else {
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
            `When trying to set value for ${patchSet.variableId} the existing value was ${currentValue} instead of ${patchSet.oldValue}`
        )
        throw Error("Old value was not as expected")
    }

    const newConfig = setValueRecursive(config, pointer, patchSet.newValue)
    return newConfig
}
