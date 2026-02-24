import {
    experiments,
    EXPERIMENT_ARM_SEPARATOR,
    ExperimentArm,
    Experiment,
    validateUniqueExperimentIds,
} from "@ourworldindata/utils"
import * as cookie from "cookie"
import { SerializeOptions } from "cookie"
import { Env } from "./env.js"

export interface ServerCookie {
    name: string
    value: string
    options?: SerializeOptions
}

export const experimentsMiddleware = async (
    context: EventContext<Env, string, Record<string, unknown>>
) => {
    if (context.request.method !== "GET") {
        return context.next()
    }

    if (shouldSkipExperiments(context.request.url)) {
        return context.next()
    }

    const cookies = cookie.parse(context.request.headers.get("cookie") || "")
    const cookiesToSet: ServerCookie[] = []
    const requestPath = new URL(context.request.url).pathname

    const activeExperiments = experiments.filter((e) => !e.isExpired())
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
                    options: {
                        expires: exp.expires,
                        path: "/",
                    },
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
        return context.next()
    }

    const response = await context.next()
    let responseWithBodyClasses = response
    const contentType = response.headers.get("content-type")
    const isHtmlResponse = contentType?.includes("text/html") ?? false
    if (
        isHtmlResponse &&
        experimentClassNames.length &&
        response.status === 200
    ) {
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
        const cookieString = cookie.serialize(
            serverCookie.name,
            serverCookie.value,
            serverCookie.options
        )
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
        /\.(js|css|svg|png|jpg|jpeg|gif|webp|woff2?|ttf|eot|otf|json|csv|ico|map)$/.test(
            pathname
        )
    ) {
        return true
    }
    return false
}
