/*
 * types for A/B testing
 */
import { SerializeOptions } from "cookie"

type Arm = {
    id: string // unique arm id
    fraction: Fraction // fraction of visitors to assign to this arm
    replaysSessionSampleRate?: Fraction // session replay sample rate for this arm
}

interface ExperimentInterface {
    id: string // unique experiment id
    expires?: Date // expiry date
    arms: Arm[]
    paths: CookiePath[] // paths on which to run the experiment (e.g. ["/grapher/life-expectancy", "/grapher/child-mortality"]).
}

type Fraction = number & { __brand: "Fraction" }

interface ServerCookie {
    name: string
    value: string
    options?: SerializeOptions
}

function isFraction(n: number): n is Fraction {
    return n >= 0 && n <= 1
}

function makeFraction(n: number): Fraction {
    if (!isFraction(n)) {
        throw new Error(`Invalid Fraction: ${n} is not between 0 and 1`)
    }
    return n as Fraction
}

type ISODateString = string & { __brand: "ISODateString" }

function isISODateString(value: string): value is ISODateString {
    return !isNaN(Date.parse(value))
}

function makeISODateString(value: string): ISODateString {
    if (!isISODateString(value)) {
        throw new Error(`Invalid ISO date string: ${value}`)
    }
    return value as ISODateString
}

type CookiePath = string & { __brand: "CookiePath" }

function isValidCookiePath(path: string): path is CookiePath {
    return (
        typeof path === "string" &&
        path.startsWith("/") &&
        !/\s/.test(path) && // no whitespace
        encodeURI(path) === path // no illegal characters
    )
}

function makeCookiePath(path: string): CookiePath {
    if (!isValidCookiePath(path)) {
        throw new Error(`Invalid cookie path: "${path}"`)
    }
    return path as CookiePath
}

export type {
    ExperimentInterface,
    Arm,
    Fraction,
    ISODateString,
    CookiePath,
    ServerCookie,
}
export { makeFraction, makeISODateString, makeCookiePath }
