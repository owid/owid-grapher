#! /usr/bin/env yarn jest

import { persistableToJS, Persistable, updatePersistables } from "./Persistable"

class SomePersistable implements Persistable {
    updateFromObject(obj: number) {
        this.value = obj
    }
    private value = 4
    toObject() {
        return this.value
    }
}

class SomeOtherPersistable implements Persistable {
    updateFromObject() {}
    toObject() {
        return 1
    }
}

describe("basics", () => {
    it("can serialize and rehydrate nested persistables", () => {
        const item = {
            a: new SomePersistable(),
            b: [new SomeOtherPersistable(), new SomeOtherPersistable(), 3]
        }
        expect(persistableToJS(item)).toEqual({ a: 4, b: [1, 1, 3] })

        updatePersistables(item, { a: 7, b: [0] })

        expect(persistableToJS(item)).toEqual({ a: 7, b: [0] })
    })
})
