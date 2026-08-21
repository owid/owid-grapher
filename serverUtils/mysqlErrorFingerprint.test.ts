import { expect, it, describe } from "vitest"

import { mysqlErrorFingerprint } from "./mysqlErrorFingerprint.js"

const mysqlError = (fields: Record<string, unknown>) =>
    Object.assign(new Error("mysql said no"), fields)

// the three kinds of error that shared one Sentry issue (ADMIN-73)
const accessDenied = mysqlError({
    code: "ER_ACCESS_DENIED_ERROR",
    errno: 1045,
    sqlState: "28000",
})
const deadlock = mysqlError({
    code: "ER_LOCK_DEADLOCK",
    errno: 1213,
    sqlState: "40001",
})
const unknownColumn = mysqlError({
    code: "ER_BAD_FIELD_ERROR",
    errno: 1054,
    sqlState: "42S22",
})

describe(mysqlErrorFingerprint, () => {
    it("fingerprints a server-side error by code and route", () => {
        expect(mysqlErrorFingerprint(accessDenied)).toEqual([
            "mysql",
            "ER_ACCESS_DENIED_ERROR",
            "{{ transaction }}",
        ])
    })

    it("gives the errors that shared one issue distinct fingerprints", () => {
        const fingerprints = [accessDenied, deadlock, unknownColumn].map(
            (error) => mysqlErrorFingerprint(error)?.join("|")
        )
        expect(new Set(fingerprints).size).toBe(3)
    })

    it("falls back to the errno when mysql2 has no name for it", () => {
        const error = mysqlError({ errno: 99999, sqlState: "HY000" })
        expect(mysqlErrorFingerprint(error)).toEqual([
            "mysql",
            "errno-99999",
            "{{ transaction }}",
        ])
    })

    it("falls back to the sqlState when there is no errno either", () => {
        const error = mysqlError({ sqlState: "HY000" })
        expect(mysqlErrorFingerprint(error)).toEqual([
            "mysql",
            "HY000",
            "{{ transaction }}",
        ])
    })

    it("leaves client-side errors to Sentry's default grouping", () => {
        // no sqlState: the server never answered, so these keep a real stack
        const connectionRefused = mysqlError({
            code: "ECONNREFUSED",
            errno: -61,
        })
        expect(mysqlErrorFingerprint(connectionRefused)).toBeUndefined()
        expect(
            mysqlErrorFingerprint(new Error("something else"))
        ).toBeUndefined()
        expect(mysqlErrorFingerprint(undefined)).toBeUndefined()
        expect(mysqlErrorFingerprint("a string")).toBeUndefined()
    })
})
