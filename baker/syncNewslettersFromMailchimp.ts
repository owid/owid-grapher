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
import { upsertNewsletters } from "../db/model/Newsletter.js"

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
    const auth = Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString(
        "base64"
    )
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
            headers: { Authorization: `Basic ${auth}` },
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
        db.TransactionCloseMode.Close
    )

    const counts = newsletters.reduce<Record<string, number>>((acc, n) => {
        acc[n.type] = (acc[n.type] ?? 0) + 1
        return acc
    }, {})
    console.log(
        `Synced ${newsletters.length} newsletters from ${campaigns.length} sent campaigns:`,
        counts
    )
    process.exit(0)
}

syncNewslettersFromMailchimp().catch(async (e) => {
    console.error("Error in syncNewslettersFromMailchimp:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
