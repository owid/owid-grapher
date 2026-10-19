import * as Sentry from "@sentry/cloudflare"
import { Env } from "../../_common/env.js"
import {
    findLatestNewsletterEditionUrl,
    isNewsletterSlug,
    NEWSLETTER_ARCHIVE_URL,
} from "../../_common/newsletters.js"

// Redirects /subscribe/latest/owid-brief and /subscribe/latest/data-insights
// to the most recent edition in the Mailchimp campaign archive, so the site can
// link to it without being rebaked whenever a newsletter goes out.
export const onRequestGet: PagesFunction<Env, "newsletter"> = async (
    context
) => {
    const { request, params } = context
    const newsletter = params.newsletter
    if (typeof newsletter !== "string" || !isNewsletterSlug(newsletter)) {
        return context.next()
    }

    // Ignore query params (e.g. utm tags) so they all share one cache entry
    const url = new URL(request.url)
    const cacheKey = new Request(`${url.origin}${url.pathname}`)
    const cached = await caches.default.match(cacheKey)
    if (cached) return cached

    try {
        const archiveResponse = await fetch(NEWSLETTER_ARCHIVE_URL)
        if (!archiveResponse.ok) {
            throw new Error(
                `Fetching the newsletter archive failed: ${archiveResponse.status}`
            )
        }
        const latestUrl = findLatestNewsletterEditionUrl(
            await archiveResponse.text(),
            newsletter
        )
        if (!latestUrl) {
            throw new Error(
                `No ${newsletter} edition found in the newsletter archive`
            )
        }

        const response = new Response(null, {
            status: 302,
            headers: {
                Location: latestUrl,
                "Cache-Control": "public, max-age=3600",
            },
        })
        context.waitUntil(caches.default.put(cacheKey, response.clone()))
        return response
    } catch (error) {
        console.error("Latest newsletter redirect error:", error)
        Sentry.captureException(error)

        // The archive lists every edition, so it's still a useful destination
        return new Response(null, {
            status: 302,
            headers: {
                Location: NEWSLETTER_ARCHIVE_URL,
                "Cache-Control": "no-cache",
            },
        })
    }
}
