import { expect, it, describe } from "vitest"

import { PassThrough } from "node:stream"
import { hashBase36, hashBase36FromStream } from "./hash.js"

describe(hashBase36, () => {
    it("hashes a string", () => {
        const hash = hashBase36("hello")
        expect(hash).toBe("14bu24ea")
    })

    it("hashes a string with a non-default hash length", () => {
        const hash = hashBase36("hello", 12)
        expect(hash).toBe("14bu24ea7cq4")
    })

    it("hashes a buffer", () => {
        const hash = hashBase36(Buffer.from("hello"))
        expect(hash).toBe("14bu24ea")
    })

    it("hashes a stream", async () => {
        const stream = new PassThrough()
        const hashPromise = hashBase36FromStream(stream)

        stream.emit("data", "hello")
        stream.end()

        const hash = await hashPromise
        expect(hash).toBe("14bu24ea")
    })
})
