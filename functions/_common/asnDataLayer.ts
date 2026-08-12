import { escapeJSONStringForInlineScript } from "@ourworldindata/utils"
import { Env } from "./env.js"

// Forwards the visitor's network operator (ASN + owning organization, resolved
// by Cloudflare on `request.cf`) to client-side Google Analytics: the baked
// HTML is the same for everyone, so this middleware injects the per-visitor
// values into the GTM dataLayer at request time, before the GTM snippet at the
// end of <head> loads the container. GTM then attaches them to all GA4 events
// as custom dimensions (configured in the GTM/GA4 UIs, not in this repo).
//
// This identifies the network that owns the visitor's IP (e.g. "Universitaet
// Bonn", "US Department of State"), not the visitor — we don't have or forward
// the IP itself. It lets us understand traffic from audiences we care about
// for impact evaluation (universities, governments, NGOs) that rarely respond
// to surveys. Not PII.
//
// `verified_bot_category` rides along for a different reason: GA4's web events
// carry no user-agent string at all, so on this channel there is no way to tell
// a crawler that renders our JS from a human — `as_org` can't do it, because
// e.g. "Google LLC" covers Googlebot, Google Cloud and Googlers alike. This is
// Cloudflare's authoritative Verified Bots label ("Search Engine Crawler",
// "AI Assistant", "AI Crawler", …), and it's the only bot signal this channel
// gets. Absent means "not a verified bot" — the key is omitted rather than sent
// empty, so it costs nothing on the ~92% of requests that aren't bots.
//
// Treat the values as free-form strings, not an enum: Cloudflare replaced this
// taxonomy on 2026-07-01 with behaviour-based categories (Search, Agent,
// Training, …) and the names we get today are explicitly the backwards-
// compatible legacy set, so they can change without a deploy on our side.
// https://developers.cloudflare.com/bots/concepts/bot/verified-bots/
//
// Deliberately NOT sending the sibling `botManagement.verifiedBot` boolean: it
// is always false on our plan, including on requests Cloudflare did give a
// category, so it would contradict this field. The category is the field that
// works for us (`cf.verified_bot_category` in Cloudflare's rules language —
// note it hangs off `cf`, not off `cf.botManagement`).
//
// Param names (`asn`, `as_org`, `verified_bot_category`) match the sampled
// server-side `cf_function_invocation` events in analytics.ts so they can be
// analyzed together downstream.

type AsnDataLayerCfProperties = Partial<
    Pick<IncomingRequestCfProperties, "asn" | "asOrganization">
> & {
    // Not in this @cloudflare/workers-types version yet, so it reaches us via
    // the cf index signature as `unknown` (same as in analytics.ts); String()
    // below keeps it type-safe without a cast.
    verifiedBotCategory?: unknown
}

export function buildDataLayerScript(
    cf: AsnDataLayerCfProperties | undefined
): string | undefined {
    if (!cf) return undefined
    const verifiedBotCategory = String(cf.verifiedBotCategory ?? "")
    const params = {
        ...(cf.asn ? { asn: cf.asn } : {}),
        // GA4 param values must be 100 characters or less
        ...(cf.asOrganization
            ? { as_org: cf.asOrganization.slice(0, 100) }
            : {}),
        ...(verifiedBotCategory
            ? { verified_bot_category: verifiedBotCategory.slice(0, 100) }
            : {}),
    }
    if (Object.keys(params).length === 0) return undefined
    const json = escapeJSONStringForInlineScript(JSON.stringify(params))
    return `<script>window.dataLayer=window.dataLayer||[];window.dataLayer.push(${json});</script>`
}

export const asnDataLayerMiddleware: PagesFunction<Env> = async (context) => {
    const { request } = context
    if (request.method !== "GET") return context.next()

    const script = buildDataLayerScript(request.cf)
    if (!script) return context.next()

    const response = await context.next()
    // Known tradeoff: on a conditional request the asset server returns a 304
    // and the browser reuses its stored body, i.e. the ASN injected on an
    // earlier visit — stale if the visitor changed networks since. Accepted:
    // it's the visitor's own previous ASN, and the staleness window closes
    // whenever that page's ETag next changes (which varies by page — not
    // every bake touches every page). The alternative (stripping validators)
    // would force full re-downloads of every repeat HTML view site-wide.
    if (
        response.status !== 200 ||
        !response.headers.get("content-type")?.includes("text/html")
    ) {
        return response
    }

    return new HTMLRewriter()
        .on("head", {
            element(element) {
                element.prepend(script, { html: true })
            },
        })
        .transform(response)
}
