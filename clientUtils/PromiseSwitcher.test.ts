import { PromiseSwitcher } from "./PromiseSwitcher.js"
import { jest } from "@jest/globals"

const delayResolve = (result: any, ms: number = 10): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(() => resolve(result), ms)
    })

const delayReject = (error: any, ms: number = 10): Promise<void> =>
    new Promise((_, reject) => {
        setTimeout(() => reject(error), ms)
    })

it("handles fulfilling single promise", async () => {
    const onResolve = jest.fn(() => undefined)
    const selector = new PromiseSwitcher({ onResolve })
    await selector.set(Promise.resolve("done"))
    expect(onResolve).toBeCalledWith("done")
    await selector.set(Promise.resolve("done"))
    expect(onResolve).toBeCalledTimes(2)
})

it("selecting a new promise while one is pending discards the pending promise", async () => {
    const onResolve = jest.fn(() => undefined)
    const selector = new PromiseSwitcher({ onResolve })
    selector.set(delayResolve("first"))
    await selector.set(Promise.resolve("second"))
    expect(onResolve).toHaveBeenCalledTimes(1)
    expect(onResolve).toHaveBeenCalledWith("second")
})

it("handles promise rejections", async () => {
    const onResolve = jest.fn(() => undefined)
    const onReject = jest.fn(() => undefined)
    const selector = new PromiseSwitcher({ onResolve, onReject })

    await selector.set(Promise.reject("error"))
    expect(onReject).toHaveBeenCalledWith("error")

    selector.set(delayResolve("success"))
    await selector.set(Promise.reject("error 2"))
    expect(onResolve).not.toHaveBeenCalled()
    expect(onReject).toHaveBeenCalledTimes(2)
})

it("handles clearing pending promise", async () => {
    const onResolve = jest.fn(() => undefined)
    const onReject = jest.fn(() => undefined)
    const selector = new PromiseSwitcher({ onResolve, onReject })

    const resolve = delayResolve("done")
    selector.set(resolve)
    selector.clear()
    await resolve

    expect(onResolve).not.toHaveBeenCalled()
    expect(onReject).not.toHaveBeenCalled()

    const reject = delayReject("error")
    selector.set(reject)
    selector.clear()
    try {
        await reject
    } catch (error) {}

    expect(onResolve).not.toHaveBeenCalled()
    expect(onReject).not.toHaveBeenCalled()
})
