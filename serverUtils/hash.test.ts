import { hashBase36 } from "./hash.js"

describe(hashBase36, () => {
    it("hashes a string", () => {
        const hash = hashBase36("hello")
        expect(hash).toBe("14bu24ea")
    })

    it("hashes a buffer", () => {
        const hash = hashBase36(Buffer.from("hello"))
        expect(hash).toBe("14bu24ea")
    })
})
