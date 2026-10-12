import { Request } from "express"

/** Whatever Express parsed a single query key into. */
type QueryValue = Request["query"][string]

/**
 * Express query values are not always strings: `?x=a&x=b` parses to an array
 * and `?x[y]=1` to an object. A handler that casts `req.query.x as string`
 * therefore hands a non-string to code typed for strings, which fails
 * somewhere downstream — a 500 with a stack trace rather than a clean 400 or
 * 404. These read a query value at face value and treat anything that is not
 * a single string as absent.
 */
export function stringParam(value: QueryValue): string | undefined {
    return typeof value === "string" ? value : undefined
}

/** A non-negative integer query value; anything else yields `fallback`. */
export function intParam(value: QueryValue, fallback: number): number {
    const raw = stringParam(value)
    if (raw === undefined || !/^\d+$/.test(raw)) return fallback
    const parsed = Number(raw)
    return Number.isSafeInteger(parsed) ? parsed : fallback
}
