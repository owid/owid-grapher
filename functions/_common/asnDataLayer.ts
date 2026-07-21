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
// Param names (`asn`, `as_org`) match the sampled server-side
// `cf_function_invocation` events in analytics.ts so they can be analyzed
// together downstream.

export function buildDataLayerScript(
    cf:
        | Partial<Pick<IncomingRequestCfProperties, "asn" | "asOrganization">>
        | undefined
): string | undefined {
    if (!cf) return undefined
    if (!cf.asn && !cf.asOrganization) return undefined
    const params = {
        asn: cf.asn ?? 0,
        // GA4 param values must be 100 characters or less
        as_org: (cf.asOrganization ?? "").slice(0, 100),
    }
    // Escape "<" so an org name can't close the script tag or open a comment
    const json = JSON.stringify(params).replace(/</g, "\\u003c")
    return `<script>window.dataLayer=window.dataLayer||[];window.dataLayer.push(${json});</script>`
}

export const asnDataLayerMiddleware: PagesFunction<Env> = async (context) => {
    const { request } = context
    if (request.method !== "GET") return context.next()

    const script = buildDataLayerScript(request.cf)
    if (!script) return context.next()

    const response = await context.next()
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
