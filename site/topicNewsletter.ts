import { slugify } from "@ourworldindata/utils"

/**
 * Link target for the "topic newsletter" subscribe card.
 *
 * NOTE: we do not yet have per-topic newsletters. There is exactly one
 * Mailchimp audience with a single interest-group category offering two cadence
 * options ("The OWID Brief" and "Data Insights") — no per-area list, group,
 * segment or tag exists. So the card links to the ordinary /subscribe page and
 * passes the area along as a `topic` query param rather than posting to
 * Mailchimp directly, which would silently subscribe people to the general
 * newsletter while implying they'd signed up for an area-specific one.
 *
 * /subscribe ignores the param (it bakes to a single static page), so an
 * unknown or absent value is harmless. Per-area Mailchimp groups still need to
 * be created before this actually subscribes anyone to a topic-specific
 * newsletter; the param is here so the link doesn't have to change when they
 * are, and so we can see in analytics which areas people subscribe from.
 */
export function getTopicNewsletterSubscribeUrl(
    baseUrl: string,
    topicArea: string
): string {
    const topicSlug = encodeURIComponent(slugify(topicArea))
    return `${baseUrl}/subscribe?topic=${topicSlug}`
}
