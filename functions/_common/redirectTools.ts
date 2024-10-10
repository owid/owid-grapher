import { Env, extensions } from "./env.js"

export function createRedirectResponse(
    redirSlug: string,
    currentUrl: URL
): Response {
    return new Response(null, {
        status: 302,
        headers: { Location: `/grapher/${redirSlug}${currentUrl.search}` },
    })
}

export async function getRedirectForUrl(env: Env, url: URL): Promise<Response> {
    const fullslug = url.pathname.split("/").pop()

    const allExtensions = Object.values(extensions)
        .map((ext) => ext.replace(".", "\\.")) // for the regex make sure we match only a single dot, not any character
        .join("|")
    const regexForKnownExtensions = new RegExp(
        `^(?<slug>.*?)(?<extension>${allExtensions})?$`
    )

    const matchResult = fullslug.match(regexForKnownExtensions)
    const slug = matchResult?.groups?.slug ?? fullslug
    const extension = matchResult?.groups?.extension ?? ""

    if (slug.toLowerCase() !== slug)
        return createRedirectResponse(`${slug.toLowerCase()}${extension}`, url)

    console.log("Looking up slug and extension", {
        slug,
        extension,
    })

    const redirectSlug = await getOptionalRedirectForSlug(slug, url, {
        ...env,
        url,
    })
    console.log("Redirect slug", redirectSlug)
    if (redirectSlug && redirectSlug !== slug) {
        return createRedirectResponse(`${redirectSlug}${extension}`, url)
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
export async function getOptionalRedirectForSlug(
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
