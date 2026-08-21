import { describe, it, expect } from "vitest"
import { deriveEditorial } from "./agenticWritingStore.js"

// The DB-backed store paths (create/decision/revision/push) are exercised by
// `make dbtest`. This unit suite covers the pure derivation helpers, which need
// no database — a fuller DB-backed rewrite of the old file-backed tests is still
// pending.
describe("agenticWritingStore — pure helpers", () => {
    it("derives editorial state from the lineage timestamps", () => {
        expect(deriveEditorial({ submittedAt: null, publishedAt: null })).toBe(
            "private"
        )
        expect(
            deriveEditorial({ submittedAt: new Date(), publishedAt: null })
        ).toBe("submitted")
        expect(
            deriveEditorial({
                submittedAt: new Date(),
                publishedAt: new Date(),
            })
        ).toBe("published")
    })
})
