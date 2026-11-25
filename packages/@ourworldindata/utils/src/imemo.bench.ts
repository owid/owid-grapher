// Run with: yarn vitest bench --run --reporter=verbose packages/@ourworldindata/utils/src/imemo.bench.ts
import { test } from "vitest"
import { imemo } from "./Util.js"

class Memoized {
    constructor(readonly x: number) {}
    @imemo get a(): number {
        return this.x + 1
    }
    @imemo get b(): number {
        return this.x + 2
    }
    @imemo get c(): number {
        return this.x + 3
    }
    @imemo get d(): number {
        return this.x + 4
    }
    @imemo get e(): number {
        return this.x + 5
    }
}

// Results are accumulated here so the benchmarked work can't be optimised away.
let sink = 0

const readAll = (o: Memoized): number => o.a + o.b + o.c + o.d + o.e

// Many short-lived instances whose getters are each read a few times,
// like the tables and columns created by every CoreTable transform.
const manyInstances = (): number => {
    let sum = 0
    for (let i = 0; i < 1000; i++) {
        const o = new Memoized(i)
        for (let r = 0; r < 3; r++) sum += readAll(o)
    }
    return sum
}

test("imemo: first access on many fresh instances", async ({ bench }) => {
    await bench("imemo", () => {
        sink += manyInstances()
    }).run()
})

// A few long-lived instances whose memoized getters are read over and over.
const warm = Array.from({ length: 100 }, (_, i) => new Memoized(i))
warm.forEach(readAll)

const readWarm = (): number => {
    let sum = 0
    for (const o of warm) sum += readAll(o)
    return sum
}

test("imemo: repeated reads of already-memoized values", async ({ bench }) => {
    await bench("imemo", () => {
        sink += readWarm()
    }).run()
})
