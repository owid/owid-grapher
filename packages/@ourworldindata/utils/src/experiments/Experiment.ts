import { validateUniqueStrings } from "./utils.js"
import { EXPERIMENT_ARM_SEPARATOR, EXPERIMENT_PREFIX } from "./constants.js"

const DEFAULT_COOKIE_EXPIRY = new Date(Date.now() + 7 * (24 * 60 * 60 * 1000)) // cookie expires in 7 days

/**
 * Represents an experiment with multiple arms (variants) for A/B testing or feature experimentation.
 *
 * The `Experiment` class provides configuration and validation logic for an experiment,
 * including the experiment's unique identifier, expiration date, arms (variants), and applicable cookie paths.
 *
 *
 * @property {ExperimentId} id - Unique identifier for the experiment.
 * @property {Date} expires - The expiration date of the experiment.
 * @property {ExperimentArm[]} arms - The list of arms (variants) in the experiment, each with its own fraction.
 * @property {CookiePath[]} paths - The list of cookie paths where the experiment applies.
 *
 * @method getArmById - Retrieves an arm by its unique identifier.
 * @method isExpired - Determines if the experiment has expired.
 *
 * @throws {Error} If the sum of arm fractions does not equal 1, if arm IDs are not unique, or if
 * any `${experimentId}-${armId}` exceeds 100 characters.
 */
export class Experiment {
    id: ExperimentId
    expires: Date
    arms: ExperimentArm[]
    paths: string[]
    unitOfAssignment: UnitOfAssignment
    pathArms?: Record<string, string>

    constructor(data: RawExperiment) {
        this.id = asExperimentId(`${EXPERIMENT_PREFIX}-${data.id}`)
        this.expires =
            data.expires !== undefined
                ? new Date(data.expires)
                : DEFAULT_COOKIE_EXPIRY
        this.arms = data.arms.map((a) => ({
            id: asArmId(a.id),
            fraction: a.fraction,
            replaysSessionSampleRate: a.replaysSessionSampleRate,
        }))
        this.unitOfAssignment = data.unitOfAssignment ?? "visitor"
        this.pathArms = data.pathArms
        // A page-assigned experiment's `paths` are exactly the keys of its
        // pre-registered assignment, so callers that only ask "is this page in
        // the experiment at all?" keep working without knowing about `pathArms`.
        this.paths = data.pathArms
            ? Object.keys(data.pathArms)
            : (data.paths ?? [])

        this.validate()
    }

    private validate(): void {
        if (!this.validateArmFractions()) {
            throw new Error(
                `Arm fractions in experiment "${this.id}" do not sum to 1`
            )
        }
        if (!this.validatePathArms()) {
            throw new Error(
                `Experiment "${this.id}" assigns a path to an arm that does not exist`
            )
        }
        if (this.unitOfAssignment === "page" && !this.pathArms) {
            throw new Error(
                `Page-assigned experiment "${this.id}" must supply "pathArms"`
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

    private validatePathArms(): boolean {
        if (!this.pathArms) return true
        const armIds = new Set<string>(this.arms.map((a) => a.id))
        return Object.values(this.pathArms).every((armId) => armIds.has(armId))
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

    getArmById(id: string): ExperimentArm | undefined {
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
        return this.paths.some((path) => this.isUrlInPath(url, path))
    }

    private isUrlInPath(url: string, path: string): boolean {
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

        // If none of the above, return false
        return false
    }

    /*
     * The arm a given URL is assigned to, for page-assigned (cluster
     * randomised) experiments.
     *
     * Every enrolled page has a fixed, pre-registered arm, so the design a
     * visitor sees depends only on which page they are on — not on a cookie.
     * That makes the assignment reproducible at bake time as well as at the
     * edge, which is what lets the baker decide per page which markup to emit.
     *
     * @returns the arm id, or `undefined` if this isn't a page-assigned
     * experiment or the URL isn't enrolled.
     */
    getArmForUrl(url: string): string | undefined {
        if (this.unitOfAssignment !== "page" || !this.pathArms) return undefined
        return Object.entries(this.pathArms).find(([path]) =>
            this.isUrlInPath(url, path)
        )?.[1]
    }
}

export type ExperimentArm = {
    id: ArmId // unique arm id
    fraction: number // fraction of visitors to assign to this arm
    replaysSessionSampleRate?: number // session replay sample rate for this arm
}

type RawArm = {
    id: string
    fraction: number
    replaysSessionSampleRate?: number
}

/**
 * What gets randomised into an arm.
 *
 * - `visitor` (the default): each visitor draws an arm once and carries it in a
 *   cookie, so the same page can serve either design.
 * - `page`: each enrolled page has a fixed arm, so every visitor to that page
 *   sees the same design. Cluster randomisation — less statistical power per
 *   visitor, but it needs no dual-rendering, which is why it suits experiments
 *   whose arms differ in server-rendered markup.
 */
export type UnitOfAssignment = "visitor" | "page"

type RawExperiment = {
    id: string
    expires: string
    arms: RawArm[]
    unitOfAssignment?: UnitOfAssignment
    /** Page-assigned experiments only: the pre-registered path -> arm map.
     * Supplied instead of `paths`, which is derived from its keys. */
    pathArms?: Record<string, string>
    paths?: string[]
}

type ExperimentId = string & { readonly __brand: "ExperimentId" }

function asExperimentId(value: string): ExperimentId {
    if (value.length > 32) {
        throw new Error("Experiment ID exceeds maximum length of 32 characters")
    }

    // Check if the value contains only allowed characters for Sentry tag keys:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/enriching-events/tags
    const allowedPattern = /^[a-zA-Z0-9_.:-]+$/
    if (!allowedPattern.test(value)) {
        throw new Error(
            "Experiment ID contains invalid characters. Only letters (a-zA-Z), numbers (0-9), underscores (_), periods (.), colons (:), and dashes (-) are allowed"
        )
    }

    return value as ExperimentId
}

type ArmId = string & { readonly __brand: "ArmId" }

function asArmId(value: string): ArmId {
    if (value.length > 200) {
        throw new Error("Arm ID exceeds maximum length of 200 characters")
    }

    // Check if the value contains newline characters (not allowed for Sentry tag values)
    if (value.includes("\n")) {
        throw new Error(
            "Arm ID contains invalid characters. Newline characters (\\n) are not allowed"
        )
    }

    return value as ArmId
}

export function validateUniqueExperimentIds(
    experiments: Experiment[]
): boolean {
    const ids = experiments.map((e) => e.id)
    return validateUniqueStrings(ids)
}
