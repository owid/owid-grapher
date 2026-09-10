import {
    get as getCookie,
    getAll as getAllCookies,
    set as setCookie,
} from "es-cookie"
import { EXPERIMENT_ARM_SEPARATOR, EXPERIMENT_PREFIX } from "./constants.js"
import { Experiment, ExperimentArm } from "./Experiment.js"
import { experiments as allExperiments } from "./config.js"

/*
 * Experiment arms in local development.
 *
 * Visitors are assigned to an arm by the edge middleware
 * (functions/_common/experiments.ts), which sets an `exp-<id>` cookie and
 * adds an `exp-<id>--<arm>` class to <body>. Under `make up` that middleware
 * doesn't run, so nothing here assigns an arm or stamps a class — this module
 * stands in for it, and lets an arm be picked from the URL:
 *
 *     /latest?exp-latest-sticky-filters-v1=fully-sticky
 *
 * It sets the cookie the middleware would (so the choice survives reloads
 * once the parameter is gone), strips the parameter from the URL, and makes
 * the body classes match the cookies.
 *
 * This is development-only: its one caller is guarded by
 * `ENV === "development"`, a build-time constant, so the module is absent
 * from the staging and production bundles. Where the middleware does run, an
 * arm is switched by setting the cookie from `/exp` (functions/exp/index.ts)
 * instead, which needs no code in the browser and none in the request path.
 *
 * Only registered, unexpired experiments and known arm ids are accepted;
 * anything else is ignored.
 */

export interface ExperimentOverride {
    experiment: Experiment
    arm: ExperimentArm
}

/** The `?exp-<id>=<arm>` overrides in a query string that name an active
 * experiment and one of its arms. */
export function parseExperimentOverrides(
    search: string,
    experiments: Experiment[] = allExperiments
): ExperimentOverride[] {
    const overrides: ExperimentOverride[] = []
    for (const [key, value] of new URLSearchParams(search)) {
        if (!key.startsWith(`${EXPERIMENT_PREFIX}-`)) continue
        const experiment = experiments.find((e) => e.id === key)
        if (!experiment || experiment.isExpired()) continue
        const arm = experiment.getArmById(value)
        if (!arm) continue
        overrides.push({ experiment, arm })
    }
    return overrides
}

/** Body class for an experiment arm, e.g. `exp-foo-v1--treatment`. */
export function experimentBodyClass(
    experimentId: string,
    armId: string
): string {
    return `${experimentId}${EXPERIMENT_ARM_SEPARATOR}${armId}`
}

/** The body classes that should be present for the given cookies on the
 * given path: one per active experiment whose paths match and whose cookie
 * names a known arm. */
export function expectedExperimentBodyClasses(
    cookies: Record<string, string>,
    pathname: string,
    experiments: Experiment[] = allExperiments
): string[] {
    return experiments
        .filter((e) => !e.isExpired() && e.isUrlInPaths(pathname))
        .flatMap((e) => {
            const arm = e.getArmById(cookies[e.id] ?? "")
            return arm ? [experimentBodyClass(e.id, arm.id)] : []
        })
}

/** Make <body>'s `exp-*--*` classes match the experiment cookies: adds the
 * missing ones (the middleware doesn't run in local dev) and removes stale
 * ones for the same experiments. */
export function syncExperimentBodyClasses(): void {
    if (typeof document === "undefined") return
    const expected = new Set(
        expectedExperimentBodyClasses(getAllCookies(), window.location.pathname)
    )
    const experimentIds = new Set(
        [...expected].map((c) => c.split(EXPERIMENT_ARM_SEPARATOR)[0])
    )
    const stale = [...document.body.classList].filter((className) => {
        const [experimentId] = className.split(EXPERIMENT_ARM_SEPARATOR)
        return experimentIds.has(experimentId) && !expected.has(className)
    })
    document.body.classList.remove(...stale)
    document.body.classList.add(...expected)
}

/**
 * Apply any `?exp-<id>=<arm>` overrides in the current URL — set the cookies,
 * drop the parameters from the URL — then sync the body classes with the
 * cookies. Call once, before any page code reads the experiment state.
 */
export function applyExperimentOverrides(): void {
    if (typeof window === "undefined") return
    const overrides = parseExperimentOverrides(window.location.search)
    if (overrides.length) {
        for (const { experiment, arm } of overrides) {
            if (getCookie(experiment.id) === arm.id) continue
            setCookie(experiment.id, arm.id, {
                expires: experiment.expires,
                path: "/",
            })
        }
        const url = new URL(window.location.href)
        for (const { experiment } of overrides)
            url.searchParams.delete(experiment.id)
        window.history.replaceState(window.history.state, "", url)
    }
    syncExperimentBodyClasses()
}
