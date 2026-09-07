import {
    experiments,
    EXPERIMENT_ARM_SEPARATOR,
    ExperimentArm,
    Experiment,
    parseExperimentOverrides,
    validateUniqueExperimentIds,
} from "@ourworldindata/utils"
import { parseCookie, stringifySetCookie, type SetCookie } from "cookie"
import { Env } from "./env.js"

/**
 * Assigns visitors to experiment arms: sets the `exp-<id>` cookie and stamps
 * the matching `exp-<id>--<arm>` class on <body>.
 *
 * `configuredExperiments` is only there for tests, which need a stable
 * experiment list rather than whichever experiments happen to be live.
 */
export const experimentsMiddleware = async (
    context: EventContext<Env, string, Record<string, unknown>>,
    configuredExperiments: Experiment[] = experiments
) => {
    if (context.request.method !== "GET") {
        return context.next()
    }

    if (shouldSkipExperiments(context.request.url)) {
        return context.next()
    }

    const response = await context.next()
    const contentType = response.headers.get("content-type")
    if (!contentType?.includes("text/html")) {
        return response
    }

    const cookies = parseCookie(context.request.headers.get("cookie") || "")
    const cookiesToSet: SetCookie[] = []
    const requestUrl = new URL(context.request.url)
    const requestPath = requestUrl.pathname

    // An `?exp-<id>=<arm>` parameter forces an arm, beating both the cookie
    // and a fresh assignment, so that the HTML we hand back already carries
    // the forced arm. The client (applyExperimentOverrides) sets the same
    // cookie and drops the parameter from the URL.
    for (const { experiment, arm } of parseExperimentOverrides(
        requestUrl.search,
        configuredExperiments
    )) {
        if (cookies[experiment.id] === arm.id) continue
        cookiesToSet.push({
            name: experiment.id,
            value: arm.id,
            expires: experiment.expires,
            path: "/",
        })
        cookies[experiment.id] = arm.id
    }

    const activeExperiments = configuredExperiments.filter(
        (e) => !e.isExpired()
    )
    const activeExperimentsOnPath = activeExperiments.filter((exp) =>
        exp.isUrlInPaths(requestPath)
    )

    if (activeExperimentsOnPath.length) {
        if (!validateUniqueExperimentIds(activeExperiments)) {
            throw new Error(`Experiment IDs are not unique`)
        }

        for (const exp of activeExperimentsOnPath) {
            if (!Object.prototype.hasOwnProperty.call(cookies, exp.id)) {
                const assignedArm = assignToArm(exp)
                cookiesToSet.push({
                    name: exp.id,
                    value: assignedArm.id,

                    expires: exp.expires,
                    path: "/",
                })
                cookies[exp.id] = assignedArm.id
            }
        }

        if (cookiesToSet.length) {
            context.data.cookiesToSet = cookiesToSet
        }
    }

    const combinedCookies = {
        ...cookies,
        ...Object.fromEntries(cookiesToSet.map((c) => [c.name, c.value])),
    }
    const experimentClassNames = Array.from(
        new Set(
            activeExperimentsOnPath
                .map((exp) => [exp.id, combinedCookies[exp.id]] as const)
                .filter(([_id, value]) => Boolean(value))
                .map(
                    ([key, value]) =>
                        `${key}${EXPERIMENT_ARM_SEPARATOR}${value}`
                )
        )
    )

    if (!cookiesToSet.length && !experimentClassNames.length) {
        return response
    }

    let responseWithBodyClasses = response
    if (experimentClassNames.length && response.status === 200) {
        responseWithBodyClasses = addClassNamesToBody(
            response,
            experimentClassNames
        )
    }

    if (!cookiesToSet.length) {
        return responseWithBodyClasses
    }

    const headers = new Headers(responseWithBodyClasses.headers)
    for (const serverCookie of cookiesToSet) {
        const cookieString = stringifySetCookie(serverCookie)
        headers.append("Set-Cookie", cookieString)
    }
    return new Response(responseWithBodyClasses.body, {
        status: responseWithBodyClasses.status,
        statusText: responseWithBodyClasses.statusText,
        headers,
    })
}

function addClassNamesToBody(page: Response, classNames: string[]) {
    const rewriter = new HTMLRewriter().on("body", {
        element(element) {
            const existingClass = element.getAttribute("class")
            const existingClassNames = new Set(
                (existingClass ?? "").split(/\s+/).filter(Boolean)
            )
            for (const className of classNames) {
                existingClassNames.add(className)
            }
            element.setAttribute(
                "class",
                Array.from(existingClassNames).join(" ")
            )
        },
    })

    return rewriter.transform(page)
}

/**
 * Assigns a visitor to an experimental arm based on a random draw.
 *
 * @param experiment - The experiment to assign the visitor to.
 * @returns The assigned experimental arm.
 */
function assignToArm(experiment: Experiment): ExperimentArm {
    const p = Math.random()
    let assignedArm = experiment.arms[0] // default to first arm
    let cumulFraction = 0
    for (const arm of experiment.arms) {
        const assignToArm =
            p >= cumulFraction && p < cumulFraction + arm.fraction
        if (assignToArm) {
            assignedArm = arm
            break
        }
        cumulFraction += arm.fraction
    }
    return assignedArm
}

/**
 * Checks if a given URL points to a static asset file.
 *
 * This function parses the provided URL and checks if its pathname ends with a common static asset file extension,
 * such as JavaScript, CSS, image, font, JSON, icon, or source map files.
 *
 * @param url - The URL string to check.
 * @returns `true` if the URL points to a static asset, `false` otherwise.
 *
 * @example
 * shouldSkipExperiments("https://example.com/styles/main.css") // true
 * shouldSkipExperiments("https://example.com/data") // false
 */
function shouldSkipExperiments(url: string): boolean {
    const pathname = new URL(url).pathname
    if (
        /\.(js|mjs|css|svg|png|jpg|jpeg|gif|webp|woff2?|ttf|eot|otf|json|csv|ico|map)$/.test(
            pathname
        )
    ) {
        return true
    }
    return false
}
