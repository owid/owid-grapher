import { expect, it } from "vitest"

import {
    objectWithPersistablesToObject,
    Persistable,
    updatePersistables,
    deleteRuntimeAndUnchangedProps,
} from "./Persistable.js"
import { observable, makeObservable } from "mobx"
import { enumerable } from "@ourworldindata/types"

interface CharacterInterface {
    name: string
    country: string
}

interface GameBoyGameInterface {
    title?: string
    players?: number
    relatedGames?: GameBoyGameInterface[]
    characters?: CharacterInterface[]
    mainCharacter?: CharacterInterface
}

class GameBoyGameDefaults implements GameBoyGameInterface {
    @observable @enumerable accessor title: string | undefined = undefined
    @observable @enumerable accessor players: number | undefined = 2
    @observable @enumerable accessor relatedGames:
        | GameBoyGameDefaults[]
        | undefined = undefined
    @observable @enumerable accessor characters:
        | CharacterInterface[]
        | undefined = undefined
    @observable @enumerable accessor mainCharacter:
        | CharacterInterface
        | undefined = undefined

    constructor() {
        makeObservable(this)
    }
}

class GameBoyGame extends GameBoyGameDefaults implements Persistable {
    constructor(obj?: GameBoyGameInterface) {
        super()
        makeObservable(this)
        if (obj) this.updateFromObject(obj)
    }

    updateFromObject(obj: GameBoyGameInterface): void {
        updatePersistables(this, obj)
        if (obj.mainCharacter)
            this.mainCharacter = new Character(obj.mainCharacter)
        if (obj.relatedGames)
            this.relatedGames = obj.relatedGames.map(
                (config) => new GameBoyGame(config)
            )
    }

    toObject(): GameBoyGameInterface {
        const obj = objectWithPersistablesToObject(this)

        return deleteRuntimeAndUnchangedProps(obj, new GameBoyGame())
    }

    @observable @enumerable accessor someRuntimeProp = 5
}

class CharacterDefaults {
    @observable @enumerable accessor name = ""
    @observable @enumerable accessor country = ""

    constructor() {
        makeObservable(this)
    }
}

class Character
    extends CharacterDefaults
    implements CharacterInterface, Persistable
{
    constructor(props?: CharacterInterface) {
        super()
        if (props) this.updateFromObject(props)
    }

    toObject(): { name: string; country: string } {
        const { name, country } = this
        return {
            name,
            country,
        }
    }

    updateFromObject(obj: CharacterInterface): void {
        this.name = obj.name
        this.country = obj.country
    }
}

it("can serialize empty persistables", () => {
    const game = new GameBoyGame()
    expect(game.toObject()).toEqual({})
})

it("can serialize persistables and update them", () => {
    const game = new GameBoyGame({ title: "SurfTime" })
    expect(game.toObject()).toEqual({ title: "SurfTime" })

    game.updateFromObject({ title: "SurfTimePro" })
    expect(game.toObject()).toEqual({ title: "SurfTimePro" })
})

it("does not serialize runtime props", () => {
    const game = new GameBoyGame({ title: "SurfTime" })
    expect((game.toObject() as any).someRuntimeProp).toEqual(undefined)
})

it("can serialize nested persistables", () => {
    const game = new GameBoyGame({
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

it("can serialize only the desired properties", () => {
    expect(objectWithPersistablesToObject({ foo: 1, bar: 2 }, ["foo"])).toEqual(
        {
            foo: 1,
        }
    )
})

it("can handle an array of persistables", () => {
    const game = new GameBoyGame({
        title: "SurfTime",
        relatedGames: [new GameBoyGame({ title: "TestGame" })],
    })
    game.updateFromObject({
        title: "SurfTime2",
        relatedGames: [{ title: "TestGame2" }],
    })
    expect(game.relatedGames![0].players).toEqual(2)
})

it("can handle Infinity", () => {
    const game = new GameBoyGame({
        players: Infinity,
    })
    const persisted = deleteRuntimeAndUnchangedProps(
        game,
        new GameBoyGame({ players: -Infinity })
    )
    expect(persisted).toEqual({ players: Infinity })
})
