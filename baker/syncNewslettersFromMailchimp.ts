// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../db/db.js"
import {
    MAILCHIMP_API_KEY,
    MAILCHIMP_API_SERVER,
} from "../settings/serverSettings.js"
import { DbInsertNewsletter, NewsletterType } from "@ourworldindata/types"
import {
    getBriefNewsletterIdsMissingImage,
    setNewsletterImageUrl,
    upsertNewsletters,
} from "../db/model/Newsletter.js"

/**
 * Syncs sent Mailchimp campaigns into the `newsletters` DB table, from which
 * the baker feeds the /latest newsletter tiles and the /subscribe example
 * links. Intended to be run on a schedule (e.g. a Buildkite cron); each run
 * pages through the full campaign history and upserts, so it's idempotent
 * and self-heals gaps.
 *
 * Newsletters deliberately stay out of Algolia (and thus out of /search and
 * the atom feeds, which Mailchimp itself consumes to send newsletters).
 *
 * Note: Mailchimp API keys expire one year after creation. When the key
 * expires this script exits with an error (caught by Sentry) — generate a
 * new key in Mailchimp and update MAILCHIMP_API_KEY in the server settings.
 */

// The main OWID audience. Campaigns sent to other lists are test sends
// (e.g. "[PREFLIGHT] …") and are skipped.
const MAILCHIMP_LIST_ID = "2e166c1fc1"

// Audience interest-group ids ("Newsletter" groups) that identify which
// newsletter a campaign was sent to. Stable machine ids — unlike subject
// lines, which have changed over the years ("Biweekly Digest" → "The OWID
// Brief") and would misclassify most of the history.
const INTEREST_ID_TO_TYPE: Record<string, NewsletterType> = {
    "7aa5a63b3f": "owid-brief",
    "7f9fa4b5c4": "data-insight",
}

const PAGE_SIZE = 1000

// The Brief's template chrome (header banner etc.) is rendered as full-width
// images; edition-specific content images are narrower (inset by the content
// block padding). Used to pick the first *content* image of an edition as
// its /latest tile image.
const TEMPLATE_IMAGE_MIN_WIDTH = 600

function mailchimpAuthHeader(): string {
    const auth = Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString(
        "base64"
    )
    return `Basic ${auth}`
}

interface MailchimpCampaign {
    id: string
    send_time?: string
    long_archive_url?: string
    settings?: {
        subject_line?: string
    }
    recipients?: {
        list_id?: string
        segment_opts?: {
            conditions?: {
                condition_type?: string
                value?: string[]
            }[]
        }
    }
}

interface MailchimpCampaignsResponse {
    campaigns: MailchimpCampaign[]
    total_items: number
}

async function fetchAllSentCampaigns(): Promise<MailchimpCampaign[]> {
    const fields = [
        "total_items",
        "campaigns.id",
        "campaigns.send_time",
        "campaigns.long_archive_url",
        "campaigns.settings.subject_line",
        "campaigns.recipients.list_id",
        "campaigns.recipients.segment_opts.conditions",
    ].join(",")

    const campaigns: MailchimpCampaign[] = []
    let offset = 0
    while (true) {
        const url = `https://${MAILCHIMP_API_SERVER}.api.mailchimp.com/3.0/campaigns?status=sent&count=${PAGE_SIZE}&offset=${offset}&fields=${fields}`
        const response = await fetch(url, {
            headers: { Authorization: mailchimpAuthHeader() },
        })
        if (!response.ok) {
            throw new Error(
                `Mailchimp campaigns request failed: ${response.status} ${response.statusText}`
            )
        }
        const data = (await response.json()) as MailchimpCampaignsResponse
        campaigns.push(...data.campaigns)
        offset += PAGE_SIZE
        if (offset >= data.total_items) break
    }
    return campaigns
}

function deriveNewsletterType(
    campaign: MailchimpCampaign
): NewsletterType | undefined {
    const conditions = campaign.recipients?.segment_opts?.conditions ?? []
    for (const condition of conditions) {
        if (condition.condition_type !== "Interests") continue
        for (const interestId of condition.value ?? []) {
            const type = INTEREST_ID_TO_TYPE[interestId]
            if (type) return type
        }
    }
    return undefined
}

function campaignToNewsletter(
    campaign: MailchimpCampaign
): DbInsertNewsletter | undefined {
    if (campaign.recipients?.list_id !== MAILCHIMP_LIST_ID) return undefined

    const type = deriveNewsletterType(campaign)
    if (!type) return undefined

    const title = campaign.settings?.subject_line
    const url = campaign.long_archive_url
    const sendTime = campaign.send_time
    // A handful of historical campaigns lack a subject line (one-off
    // experiments) — skip them, they'd make empty tiles.
    if (!title || !url || !sendTime) return undefined

    return {
        mailchimpId: campaign.id,
        type,
        title,
        url,
        publishedAt: new Date(sendTime),
    }
}

/**
 * Extract the first edition-specific content image from a campaign's HTML,
 * or "" if none qualifies. Template chrome (the Brief's header banner) is
 * skipped via the full-width heuristic — see TEMPLATE_IMAGE_MIN_WIDTH.
 *
 * The returned URL points at Mailchimp's public CDN (mcusercontent.com) and
 * is hotlinked as-is on /latest tiles. If we ever want to drop that external
 * dependency, this is the place to re-upload to Cloudflare Images instead.
 */
async function fetchFirstContentImage(campaignId: string): Promise<string> {
    const url = `https://${MAILCHIMP_API_SERVER}.api.mailchimp.com/3.0/campaigns/${campaignId}/content?fields=html`
    const response = await fetch(url, {
        headers: { Authorization: mailchimpAuthHeader() },
    })
    if (!response.ok) {
        throw new Error(
            `Mailchimp content request for campaign ${campaignId} failed: ${response.status} ${response.statusText}`
        )
    }
    const { html } = (await response.json()) as { html?: string }
    if (!html) return ""

    for (const tag of html.match(/<img[^>]*>/g) ?? []) {
        const src = tag.match(/src="([^"]+)"/)?.[1]
        if (!src || !src.startsWith("https://")) continue
        const width = parseInt(tag.match(/width="(\d+)"/)?.[1] ?? "", 10)
        if (width >= TEMPLATE_IMAGE_MIN_WIDTH) continue
        return src
    }
    return ""
}

/** Fill in tile images for OWID Brief newsletters that haven't been checked
 * yet. One content request per campaign, so the backfill is a one-off burst
 * and steady-state runs only fetch newly synced editions. */
async function syncNewsletterImages(): Promise<void> {
    const missingIds = await db.knexReadonlyTransaction(
        getBriefNewsletterIdsMissingImage,
        db.TransactionCloseMode.KeepOpen
    )
    if (!missingIds.length) return

    let found = 0
    for (const mailchimpId of missingIds) {
        const imageUrl = await fetchFirstContentImage(mailchimpId)
        if (imageUrl) found++
        await db.knexReadWriteTransaction(
            (trx) => setNewsletterImageUrl(trx, mailchimpId, imageUrl),
            db.TransactionCloseMode.KeepOpen
        )
    }
    console.log(
        `Checked ${missingIds.length} newsletters for tile images, found ${found}`
    )
}

const syncNewslettersFromMailchimp = async (): Promise<void> => {
    if (!MAILCHIMP_API_KEY) {
        console.error("MAILCHIMP_API_KEY is not set. Exiting.")
        process.exit(1)
    }

    const campaigns = await fetchAllSentCampaigns()
    const newsletters = campaigns
        .map(campaignToNewsletter)
        .filter((n) => n !== undefined)

    await db.knexReadWriteTransaction(
        (trx) => upsertNewsletters(trx, newsletters),
        db.TransactionCloseMode.KeepOpen
    )

    const counts = newsletters.reduce<Record<string, number>>((acc, n) => {
        acc[n.type] = (acc[n.type] ?? 0) + 1
        return acc
    }, {})
    console.log(
        `Synced ${newsletters.length} newsletters from ${campaigns.length} sent campaigns:`,
        counts
    )

    await syncNewsletterImages()

    await db.closeTypeOrmAndKnexConnections()
    process.exit(0)
}

syncNewslettersFromMailchimp().catch(async (e) => {
    console.error("Error in syncNewslettersFromMailchimp:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
