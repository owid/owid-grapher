import { expect, it, describe } from "vitest"

import { PassThrough } from "node:stream"
import { hashBase36, hashBase36FromStream, hashHex, hashMd5 } from "./hash.js"

describe(hashMd5, () => {
    it("hashes a string", () => {
        const hash = hashMd5("hello")
        expect(hash).toBe("5d41402abc4b2a76b9719d911017c592")
    })
    it("hashes a string with a non-default hash length", () => {
        const hash = hashMd5("hello", 12)
        expect(hash).toBe("5d41402abc4b")
    })
})

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

describe(hashHex, () => {
    it("hashes a string", () => {
        const hash = hashHex("hello")
        expect(hash).toBe("2cf24dba")
    })

    it("hashes a string with a non-default hash length", () => {
        const hash = hashHex("hello", 12)
        expect(hash).toBe("2cf24dba5fb0")
    })

    it("hashes a buffer", () => {
        const hash = hashHex(Buffer.from("hello"))
        expect(hash).toBe("2cf24dba")
    })
})
