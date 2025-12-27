import { Env, extensions } from "./env.js"

export function createRedirectResponse(
    currentUrl: URL,
    targetPath: string,
    targetParams?: URLSearchParams
): Response {
    const mergedParams = new URLSearchParams(targetParams)
    for (const [key, value] of currentUrl.searchParams.entries()) {
        mergedParams.set(key, value)
    }
    const url = `${targetPath}${mergedParams.toString() ? `?${mergedParams.toString()}` : ""}`
    return new Response(null, {
        status: 302,
        headers: { Location: url },
    })
}

export async function getRedirectForUrl(env: Env, url: URL) {
    const fullslug = url.pathname.split("/").pop()

    const allExtensions = Object.values(extensions)
        .map((ext) => ext.replace(".", "\\.")) // for the regex make sure we match only a single dot, not any character
        .join("|")
    const regexForKnownExtensions = new RegExp(
        `^(?<slug>.*?)(?<extension>${allExtensions})?$`
    )

    const matchResult = fullslug?.match(regexForKnownExtensions)
    const slug = matchResult?.groups?.slug ?? fullslug ?? ""
    const extension = matchResult?.groups?.extension ?? ""

    if (slug.toLowerCase() !== slug)
        return createRedirectResponse(
            url,
            `/grapher/${slug.toLowerCase()}${extension}`
        )

    console.log("Looking up slug and extension", {
        slug,
        extension,
    })

    const target = await getOptionalGrapherRedirectForSlug(slug, url, {
        ...env,
        url,
    })
    console.log("Redirect target", target)
    const [redirectSlug, redirectParams] = target?.split("?", 2) ?? []
    if (redirectSlug && redirectSlug !== slug) {
        return createRedirectResponse(
            url,
            `/grapher/${redirectSlug}${extension}`,
            redirectParams ? new URLSearchParams(redirectParams) : undefined
        )
    }
}

export async function handlePageNotFound(
    env: Env,
    response: Response
): Promise<Response> {
    const url = new URL(response.url)
    console.log("Handling 404 for", url.pathname)
    const redirect = await getRedirectForUrl(env, url)
    return redirect || response
}

export async function getOptionalGrapherRedirectForSlug(
    slug: string,
    baseUrl: URL,
    env: Env
): Promise<string | undefined> {
    const redirects: Record<string, string> = await env.ASSETS.fetch(
        new URL("/grapher/_grapherRedirects.json", baseUrl),
        { cf: { cacheTtl: 2 * 60 } }
    )
        .then((r): Promise<Record<string, string>> => r.json())
        .catch((e) => {
            console.error("Error fetching redirects", e)
            return {}
        })
    return redirects[slug]
}

export async function getRedirectForExplorerUrl(
    env: Env,
    url: URL
): Promise<Response | undefined> {
    const fullslug = url.pathname.split("/").pop()

    const allExtensions = Object.values(extensions)
        .map((ext) => ext.replace(".", "\\."))
        .join("|")
    const regexForKnownExtensions = new RegExp(
        `^(?<slug>.*?)(?<extension>${allExtensions})?$`
    )

    const matchResult = fullslug?.match(regexForKnownExtensions)
    const slug = matchResult?.groups?.slug ?? fullslug
    const extension = matchResult?.groups?.extension ?? ""

    if (slug && slug.toLowerCase() !== slug)
        return createRedirectResponse(
            url,
            `/explorers/${slug.toLowerCase()}${extension}`
        )

    console.log("Looking up explorer slug and extension", {
        slug,
        extension,
    })

    // Explorer redirects contain full target paths (e.g. /grapher/slug?params)
    const target = await getOptionalExplorerRedirectForSlug(slug, url, env)
    console.log("Explorer redirect target", target)
    if (target) {
        const [targetPath, targetParams] = target.split("?", 2)
        // Append extension to the target path if present
        const targetPathWithExtension = extension
            ? `${targetPath}${extension}`
            : targetPath
        return createRedirectResponse(
            url,
            targetPathWithExtension,
            targetParams ? new URLSearchParams(targetParams) : undefined
        )
    }
    return undefined
}

async function getOptionalExplorerRedirectForSlug(
    slug: string | undefined,
    baseUrl: URL,
    env: Env
): Promise<string | undefined> {
    if (!slug) return undefined
    const redirects: Record<string, string> = await env.ASSETS.fetch(
        new URL("/explorers/_explorerRedirects.json", baseUrl),
        { cf: { cacheTtl: 2 * 60 } }
    )
        .then((r): Promise<Record<string, string>> => r.json())
        .catch((e) => {
            console.error("Error fetching explorer redirects", e)
            return {}
        })
    return redirects[slug]
}

export async function handleExplorerPageNotFound(
    env: Env,
    response: Response
): Promise<Response> {
    const url = new URL(response.url)
    console.log("Handling explorer 404 for", url.pathname)
    const redirect = await getRedirectForExplorerUrl(env, url)
    return redirect || response
}
