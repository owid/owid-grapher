import { expect, it, describe } from "vitest"

import {
    fingerprintMysqlErrors,
    mysqlErrorFingerprint,
} from "./mysqlErrorFingerprint.js"

const mysqlError = (fields: Record<string, unknown>) =>
    Object.assign(new Error("mysql said no"), fields)

// the three kinds of error that shared one Sentry issue (ADMIN-73), with the
// code/errno/sqlState triples mysql2 actually produces
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

// `type: undefined` is what makes an ErrorEvent an error rather than a transaction
const send = (originalException: unknown, transaction?: string) =>
    fingerprintMysqlErrors(
        { type: undefined, transaction },
        {
            originalException,
        }
    )

describe(mysqlErrorFingerprint, () => {
    it("fingerprints a server-side error by code", () => {
        expect(mysqlErrorFingerprint(accessDenied)).toEqual([
            "mysql",
            "ER_ACCESS_DENIED_ERROR",
        ])
    })

    it("adds the route when the error came out of a request", () => {
        expect(
            mysqlErrorFingerprint(deadlock, "PUT /admin/api/gdocs/:id")
        ).toEqual(["mysql", "ER_LOCK_DEADLOCK", "PUT /admin/api/gdocs/:id"])
    })

    it("gives the errors that shared one issue distinct fingerprints", () => {
        const fingerprints = [accessDenied, deadlock, unknownColumn].map(
            (error) => mysqlErrorFingerprint(error)?.join("|")
        )
        expect(new Set(fingerprints).size).toBe(3)
    })

    it("splits the same error code across routes", () => {
        const one = mysqlErrorFingerprint(deadlock, "PUT /admin/api/gdocs/:id")
        const other = mysqlErrorFingerprint(
            deadlock,
            "PUT /admin/api/charts/:id"
        )
        expect(one).not.toEqual(other)
    })

    it("falls back to the errno when mysql2 has no name for it", () => {
        const error = mysqlError({ errno: 99999, sqlState: "HY000" })
        expect(mysqlErrorFingerprint(error)).toEqual(["mysql", "errno-99999"])
    })

    it("falls back to the sqlState when there is no errno either", () => {
        const error = mysqlError({ sqlState: "HY000" })
        expect(mysqlErrorFingerprint(error)).toEqual(["mysql", "HY000"])
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

describe(fingerprintMysqlErrors, () => {
    it("sets the fingerprint from the event's own transaction", () => {
        expect(
            send(accessDenied, "PUT /admin/api/gdocs/:id").fingerprint
        ).toEqual([
            "mysql",
            "ER_ACCESS_DENIED_ERROR",
            "PUT /admin/api/gdocs/:id",
        ])
    })

    it("leaves the event untouched when it isn't a MySQL server error", () => {
        expect(send(new Error("nope")).fingerprint).toBeUndefined()
    })

    // A route that wraps a query failure — `throw new JsonError(msg, 500, {
    // cause: error })` — was thrown from app code, so the event carries app
    // frames and Sentry groups it by where it happened, which is more specific
    // than this fingerprint. Only the unwrapped rejections need help.
    it("does not follow the cause chain of a wrapped error", () => {
        const wrapped = new Error("Failed to fetch multi-dims", {
            cause: accessDenied,
        })
        expect(
            send(wrapped, "GET /admin/api/multi-dims.json").fingerprint
        ).toBeUndefined()
    })
})
