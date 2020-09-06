import { toJS } from "mobx"

// Any classes that the user can edit, save, and then rehydrate should implement this interface
export interface Persistable {
    toObject(): any
    updateFromObject(obj: any): any
}

// Todo: see if there's a better way to do this with Mobx
// Note: this does not recurse! If we need that should be easy to add, but we didn't need it yet.
export function persistableToJS(objWithPersistables: any) {
    const obj = toJS(objWithPersistables) as any
    Object.keys(obj).forEach(key => {
        const val = obj[key]
        if (val.toObject) obj[key] = val.toObject()
        else if (Array.isArray(val)) {
            obj[key] = val.map(item => (item.toObject ? item.toObject() : item))
        }
    })
    return obj
}

// Basically does an Object.assign, except if the target is a Persistable, will call updateFromObject on
// that Persistable. It does not recurse. Will only update top level Persistables.
export function updatePersistables(target: any, obj: any) {
    for (const key in target) {
        if (key in obj) {
            const currentVal = target[key]
            const newVal = obj[key]
            if (currentVal?.updateFromObject)
                currentVal.updateFromObject(newVal)
            else target[key] = newVal
        }
    }
}
