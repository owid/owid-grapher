#! /usr/bin/env yarn jest

import {
    objectWithPersistablesToObject,
    Persistable,
    updatePersistables,
    deleteRuntimeAndUnchangedProps,
} from "./Persistable"
import { observable } from "mobx"

interface CharacterInterface {
    name: string
    country: string
}

class GameBoyGame {
    @observable title?: string
    @observable players?: number
    @observable relatedGames?: GameBoyGame[]
    @observable characters?: CharacterInterface[]
    @observable mainCharacter?: CharacterInterface
}

type GameBoyGameInterface = GameBoyGame

class PersistableGameBoyGame extends GameBoyGame implements Persistable {
    constructor(obj?: GameBoyGameInterface) {
        super()
        if (obj) this.updateFromObject(obj)
    }

    updateFromObject(obj: GameBoyGameInterface) {
        updatePersistables(this, obj)
        if (obj.mainCharacter)
            this.mainCharacter = new Character(obj.mainCharacter)
    }

    toObject(): GameBoyGameInterface {
        const obj = objectWithPersistablesToObject(this)

        return deleteRuntimeAndUnchangedProps(obj, new PersistableGameBoyGame())
    }

    @observable someRuntimeProp = 5
}

class Character implements CharacterInterface, Persistable {
    @observable name = ""
    @observable country = ""

    constructor(props?: CharacterInterface) {
        if (props) this.updateFromObject(props)
    }

    toObject() {
        const { name, country } = this
        return {
            name,
            country,
        }
    }

    updateFromObject(obj: CharacterInterface) {
        this.name = obj.name
        this.country = obj.country
    }
}

describe("basics", () => {
    it("can serialize empty persistables", () => {
        const game = new PersistableGameBoyGame()
        expect(game.toObject()).toEqual({})
    })

    it("can serialize persistables and update them", () => {
        const game = new PersistableGameBoyGame({ title: "SurfTime" })
        expect(game.toObject()).toEqual({ title: "SurfTime" })

        game.updateFromObject({ title: "SurfTimePro" })
        expect(game.toObject()).toEqual({ title: "SurfTimePro" })
    })

    it("does not serialize runtime props", () => {
        const game = new PersistableGameBoyGame({ title: "SurfTime" })
        expect((game.toObject() as any).someRuntimeProp).toEqual(undefined)
    })

    it("can serialize nested persistables", () => {
        const game = new PersistableGameBoyGame({
            title: "SurfTime",
            characters: [{ country: "USA", name: "Jill Doe" }],
            mainCharacter: { country: "CAN", name: "Jane Doe" },
        })
        expect(game.mainCharacter instanceof Character).toEqual(true)
    })

    it("handles missing values", () => {
        expect(objectWithPersistablesToObject({})).toEqual({})
        expect(objectWithPersistablesToObject({ foo: undefined })).toEqual({
            foo: undefined,
        })
    })
})
