import { toJS } from "mobx"

// Any classes that the user can edit, save, and then rehydrate should implement this interface
export interface Persistable {
    toObject(): any
    updateFromObject(obj: any): any
}

// Todo: see if there's a better way to do this with Mobx
// Note: this does not recurse! If we need that should be easy to add, but we didn't need it yet.
export function objectWithPersistablesToObject(objWithPersistables: any) {
    const obj = toJS(objWithPersistables) as any
    Object.keys(obj).forEach(key => {
        const val = obj[key]

        if (val && val.toObject) obj[key] = val.toObject()
        // Val is persistable, call toObject
        else if (Array.isArray(val))
            // Scan array for persistables and seriazile.
            obj[key] = val.map(item =>
                item?.toObject ? item.toObject() : item
            )
        else obj[key] = val
    })
    return obj
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
