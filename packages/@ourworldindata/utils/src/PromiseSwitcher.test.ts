import { expect, it, vi } from "vitest"

import { PromiseSwitcher } from "./PromiseSwitcher.js"

const delayResolve = (result: any, ms: number = 10): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(() => resolve(result), ms)
    })

const delayReject = (error: any, ms: number = 10): Promise<void> =>
    new Promise((_, reject) => {
        setTimeout(() => reject(error), ms)
    })

it("handles fulfilling single promise", async () => {
    const onResolve = vi.fn(() => undefined)
    const selector = new PromiseSwitcher({ onResolve })
    await selector.set(Promise.resolve("done"))
    expect(onResolve).toBeCalledWith("done")
    await selector.set(Promise.resolve("done"))
    expect(onResolve).toBeCalledTimes(2)
})

it("selecting a new promise while one is pending discards the pending promise", async () => {
    const onResolve = vi.fn(() => undefined)
    const selector = new PromiseSwitcher({ onResolve })
    void selector.set(delayResolve("first"))
    await selector.set(Promise.resolve("second"))
    expect(onResolve).toHaveBeenCalledTimes(1)
    expect(onResolve).toHaveBeenCalledWith("second")
})

it("handles promise rejections", async () => {
    const onResolve = vi.fn(() => undefined)
    const onReject = vi.fn(() => undefined)
    const selector = new PromiseSwitcher({ onResolve, onReject })

    await selector.set(Promise.reject("error"))
    expect(onReject).toHaveBeenCalledWith("error")

    void selector.set(delayResolve("success"))
    await selector.set(Promise.reject("error 2"))
    expect(onResolve).not.toHaveBeenCalled()
    expect(onReject).toHaveBeenCalledTimes(2)
})

it("handles clearing pending promise", async () => {
    const onResolve = vi.fn(() => undefined)
    const onReject = vi.fn(() => undefined)
    const selector = new PromiseSwitcher({ onResolve, onReject })

    const resolve = delayResolve("done")
    void selector.set(resolve)
    selector.clear()
    await resolve

    expect(onResolve).not.toHaveBeenCalled()
    expect(onReject).not.toHaveBeenCalled()

    const reject = delayReject("error")
    void selector.set(reject)
    selector.clear()
    try {
        await reject
    } catch {
        // ignore
    }

    expect(onResolve).not.toHaveBeenCalled()
    expect(onReject).not.toHaveBeenCalled()
})
