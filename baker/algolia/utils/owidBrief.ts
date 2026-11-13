import { PageChronologicalNewsletterRecord } from "@ourworldindata/types"
import {
    MAILCHIMP_API_KEY,
    MAILCHIMP_API_SERVER,
    MAILCHIMP_NEWSLETTER_LIST_ID,
} from "../../../settings/serverSettings.js"
import { logErrorAndMaybeCaptureInSentry } from "../../../serverUtils/errorLog.js"

export interface MailchimpCampaign {
    id: string
    send_time: string
    long_archive_url: string
    settings: {
        // The internal campaign name, e.g. "The OWID Brief 16 Oct 2026"
        title?: string
        // Empty for A/B-tested ("variate") campaigns
        subject_line?: string
    }
    variate_settings?: {
        subject_lines?: string[]
    }
}

interface MailchimpCampaignsResponse {
    campaigns: MailchimpCampaign[]
    total_items: number
}

const CAMPAIGN_FIELDS = [
    "total_items",
    "campaigns.id",
    "campaigns.send_time",
    "campaigns.long_archive_url",
    "campaigns.settings.title",
    "campaigns.settings.subject_line",
    "campaigns.variate_settings.subject_lines",
]

// The maximum Mailchimp allows per request
const CAMPAIGNS_PER_PAGE = 1000

const OWID_BRIEF_CAMPAIGN_TITLE_PREFIX = "The OWID Brief"

// The audience also receives other newsletters, and Mailchimp has no field
// that sets the Brief apart from them other than the campaign name.
export function isOwidBriefCampaign(campaign: MailchimpCampaign): boolean {
    return (campaign.settings.title ?? "").startsWith(
        OWID_BRIEF_CAMPAIGN_TITLE_PREFIX
    )
}

export function getOwidBriefObjectID(campaignId: string): string {
    return `mailchimp-campaign-${campaignId}`
}

// A/B-tested campaigns have no subject line of their own, and Mailchimp
// doesn't report which variant won in a way we can resolve, so we take the
// first variant.
function getCampaignSubjectLine(campaign: MailchimpCampaign): string {
    return (
        campaign.settings.subject_line ||
        campaign.variate_settings?.subject_lines?.[0] ||
        ""
    )
}

export function buildOwidBriefRecord(
    campaign: MailchimpCampaign
): PageChronologicalNewsletterRecord | null {
    const title = getCampaignSubjectLine(campaign)
    const url = campaign.long_archive_url
    const sentAt = new Date(campaign.send_time)
    if (!title || !url || Number.isNaN(sentAt.getTime())) {
        void logErrorAndMaybeCaptureInSentry(
            new Error(
                `Invalid pages-chronological record for Mailchimp campaign ${campaign.id} (${campaign.settings.title})`
            )
        )
        return null
    }

    const date = sentAt.toISOString()
    return {
        objectID: getOwidBriefObjectID(campaign.id),
        slug: campaign.id,
        title,
        excerpt: "",
        date,
        modifiedDate: date,
        authors: [],
        tags: [],
        thumbnailUrl: "",
        type: "newsletter",
        latestType: "newsletter",
        url,
    }
}

async function fetchSentCampaigns(): Promise<MailchimpCampaign[]> {
    const campaigns: MailchimpCampaign[] = []
    let totalItems = Infinity
    while (campaigns.length < totalItems) {
        const params = new URLSearchParams({
            list_id: MAILCHIMP_NEWSLETTER_LIST_ID,
            status: "sent",
            sort_field: "send_time",
            sort_dir: "DESC",
            count: String(CAMPAIGNS_PER_PAGE),
            offset: String(campaigns.length),
            fields: CAMPAIGN_FIELDS.join(","),
        })
        const response = await fetch(
            `https://${MAILCHIMP_API_SERVER}.api.mailchimp.com/3.0/campaigns?${params}`,
            {
                headers: {
                    Authorization: `Basic ${Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString("base64")}`,
                },
            }
        )
        if (!response.ok) {
            throw new Error(
                `Mailchimp campaigns request failed: ${response.status} ${await response.text()}`
            )
        }
        const page = (await response.json()) as MailchimpCampaignsResponse
        if (!page.campaigns.length) break
        campaigns.push(...page.campaigns)
        totalItems = page.total_items
    }
    return campaigns
}

/**
 * Build a pages-chronological record for every issue of The OWID Brief that
 * has been sent. Throws if Mailchimp can't be reached, so callers decide
 * whether indexing can go ahead without the newsletters.
 */
export async function getOwidBriefRecords(): Promise<
    PageChronologicalNewsletterRecord[]
> {
    if (
        !MAILCHIMP_API_KEY ||
        !MAILCHIMP_API_SERVER ||
        !MAILCHIMP_NEWSLETTER_LIST_ID
    ) {
        console.log(
            "Mailchimp is not configured. Skipping The OWID Brief records."
        )
        return []
    }

    const campaigns = await fetchSentCampaigns()
    return campaigns
        .filter(isOwidBriefCampaign)
        .map(buildOwidBriefRecord)
        .filter((record) => record !== null)
}
