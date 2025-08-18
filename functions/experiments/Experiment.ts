import {
    ExperimentInterface,
    Arm,
    CookiePath,
    makeFraction,
    makeCookiePath,
    makeISODateString,
} from "./types.js"
import { validateUniqueStrings } from "./utils.js"
import {
    EXPERIMENT_ARM_SEPARATOR,
    EXPERIMENT_PREFIX,
} from "@ourworldindata/types"

const DEFAULT_COOKIE_EXPIRY = new Date(Date.now() + 7 * (24 * 60 * 60 * 1000)) // cookie expires in 7 days

/**
 * Represents an experiment with multiple arms (variants) for A/B testing or feature experimentation.
 *
 * The `Experiment` class provides configuration and validation logic for an experiment,
 * including the experiment's unique identifier, expiration date, arms (variants), and applicable cookie paths.
 *
 * @implements {ExperimentInterface}
 *
 * @property {string} id - Unique identifier for the experiment.
 * @property {Date} expires - The expiration date of the experiment.
 * @property {Arm[]} arms - The list of arms (variants) in the experiment, each with its own fraction.
 * @property {CookiePath[]} paths - The list of cookie paths where the experiment applies.
 *
 * @method getArmById - Retrieves an arm by its unique identifier.
 * @method isExpired - Determines if the experiment has expired.
 *
 * @throws {Error} If the sum of arm fractions does not equal 1, if arm IDs are not unique, or if
 * any `${experimentId}-${armId}` exceeds 100 characters.
 */
export class Experiment implements ExperimentInterface {
    id: string
    expires: Date
    arms: Arm[]
    paths: CookiePath[]

    constructor(data: RawExperiment) {
        this.id = `${EXPERIMENT_PREFIX}-${data.id}`
        this.expires =
            data.expires !== undefined
                ? new Date(makeISODateString(data.expires))
                : DEFAULT_COOKIE_EXPIRY
        this.arms = data.arms.map((a) => ({
            id: a.id,
            fraction: makeFraction(a.fraction),
            replaysSessionSampleRate:
                a.replaysSessionSampleRate !== undefined
                    ? makeFraction(a.replaysSessionSampleRate)
                    : undefined,
        }))
        this.paths = data.paths.map(makeCookiePath)

        this.validate()
    }

    private validate(): void {
        if (!this.validateArmFractions()) {
            throw new Error(
                `Arm fractions in experiment "${this.id}" do not sum to 1`
            )
        }
        if (!this.validateUniqueArmIds()) {
            throw new Error(`Arm IDs in experiment "${this.id}" are not unique`)
        }

        if (!this.validateArmIdLengths()) {
            throw new Error(
                `One or more arms in experiment "${this.id}" are >100 characters when concatenated with experiment id`
            )
        }
    }

    private validateArmFractions(): boolean {
        const total = this.arms.reduce((sum, arm) => sum + arm.fraction, 0)
        return Math.abs(total - 1) < 1e-6
    }

    private validateUniqueArmIds(): boolean {
        const ids = this.arms.map((a) => a.id)
        return validateUniqueStrings(ids)
    }

    private validateArmIdLengths(): boolean {
        return this.arms.every(
            (arm) =>
                `${this.id}${EXPERIMENT_ARM_SEPARATOR}${arm.id}`.length <= 100
        )
    }

    getArmById(id: string): Arm | undefined {
        return this.arms.find((a) => a.id === id)
    }

    isExpired(): boolean {
        return new Date(this.expires).getTime() < Date.now()
    }

    /*
     * Check if a URL matches any of the experiment paths.
     *
     * Checks if the given URL matches any of the cookie paths defined for the
     * experiment, following the path-matching rules in https://datatracker.ietf.org/doc/html/rfc6265#section-5.1.4.
     *
     * @param url - The URL to check.
     *
     * @returns `true` if the URL matches any of the experiment paths, `false` otherwise.
     */
    isUrlInPaths(url: string): boolean {
        return this.paths.some((path) => {
            // Case 1: Exact match
            if (url === path) {
                return true
            }

            // Case 2: Cookie path is a prefix and ends with "/"
            if (path.endsWith("/") && url.startsWith(path)) {
                return true
            }

            // Case 3: Cookie path is a prefix and the next character in request path is "/"
            if (url.startsWith(path) && url.charAt(path.length) === "/") {
                return true
            }
        })
    }
}

type RawArm = {
    id: string
    fraction: number
    replaysSessionSampleRate?: number
}

type RawExperiment = {
    id: string
    expires: string
    arms: RawArm[]
    paths: string[]
}

export function validateUniqueExperimentIds(
    experiments: Experiment[]
): boolean {
    const ids = experiments.map((e) => e.id)
    return validateUniqueStrings(ids)
}
