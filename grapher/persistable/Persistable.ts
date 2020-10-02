import { toJS } from "mobx"

// Any classes that the user can edit, save, and then rehydrate should implement this interface
export interface Persistable {
    toObject(): any // This should dehydrate any runtime instances to a plain object ready to be JSON stringified
    updateFromObject(obj: any): any // This should parse an incoming object, extend the current instance, and create new instances for any non native class types
}

// Todo: see if there's a better way to do this with Mobx
export function objectWithPersistablesToObject<T>(
    objWithPersistables: T,
    keysToSerialize: string[] = []
): T {
    const obj = toJS(objWithPersistables) as any
    const keysSet = new Set(keysToSerialize)
    Object.keys(obj).forEach((key) => {
        const val = (objWithPersistables as any)[key]
        const valIsPersistable = val && val.toObject

        // Delete any keys we don't want to serialize, if a keep list is provided
        if (keysToSerialize.length && !keysSet.has(key)) {
            delete obj[key]
            return
        }

        // Val is persistable, call toObject
        if (valIsPersistable) obj[key] = val.toObject()
        else if (Array.isArray(val))
            // Scan array for persistables and seriazile.
            obj[key] = val.map((item) =>
                item?.toObject ? item.toObject() : item
            )
        else obj[key] = val
    })
    return obj as T
}

// Basically does an Object.assign, except if the target is a Persistable, will call updateFromObject on
// that Persistable. It does not recurse. Will only update top level Persistables.
export function updatePersistables(target: any, obj: any) {
    if (obj === undefined) return
    for (const key in target) {
        if (key in obj) {
            const newVal = obj[key]
            const currentVal = target[key]
            const currentValIsPersistableObject = currentVal?.updateFromObject
            if (currentValIsPersistableObject)
                currentVal.updateFromObject(newVal)
            else target[key] = newVal
        }
    }
}

// Don't persist properties that haven't changed from the defaults, and don't
// keep properties not on the comparable class
export function deleteRuntimeAndUnchangedProps<T>(
    changedObj: T,
    defaultObject: T
): T {
    const obj = changedObj as any
    const defaultObj = defaultObject as any
    const defaultKeys = new Set(Object.keys(defaultObj))
    Object.keys(obj).forEach((prop) => {
        const key = prop as any
        if (!defaultKeys.has(key)) {
            // Don't persist any runtime props not in the persistable instance
            delete obj[key]
            return
        }

        const currentValue = JSON.stringify(obj[key])
        const defaultValue = JSON.stringify(defaultObj[key])
        if (currentValue === defaultValue) {
            // Don't persist any values that weren't changed from the default
            delete obj[key]
        }
    })
    return obj
}
