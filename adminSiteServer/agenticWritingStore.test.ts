import { describe, it } from "vitest"

// Tests for the new DB-backed store are pending — they need to run against the
// `make dbtest` test database (knex transactions, real users table). The old
// file-backed test suite that lived here is gone with its store.
describe.skip(
    "agenticWritingStore — pending DB-backed rewrite (see plan task #16)",
    () => {
        it("placeholder", () => {})
    }
)
