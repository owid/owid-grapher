import { PromiseCache } from "./PromiseCache"

const wait = (ms: number) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms)
    })

it("reuses existing promise", async () => {
    const cache = new PromiseCache(async () => {
        await wait(10)
    })
    const firstPromise = cache.get("key")
    const secondPromise = cache.get("key")
    expect(firstPromise).toBe(secondPromise)
    await firstPromise
    const thirdPromise = cache.get("key")
    expect(thirdPromise).toBe(firstPromise)
})

it("promise is discarded if it rejects", async () => {
    const cache = new PromiseCache(async () => {
        await wait(10)
        throw new Error("Failed")
    })

    const firstPromise = cache.get("key")
    const secondPromise = cache.get("key")
    expect(firstPromise).toBe(secondPromise)
    expect(cache.has("key")).toBeTruthy()

    try {
        await firstPromise
        fail()
    } catch (error) {}

    expect(cache.has("key")).toBeFalsy()

    try {
        await cache.get("key")
        fail()
    } catch (error) {}

    const thirdPromise = cache.get("key")
    expect(thirdPromise).not.toBe(firstPromise)

    try {
        await thirdPromise
        fail()
    } catch (error) {}
})
