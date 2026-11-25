import {
    MAILCHIMP_API_SERVER,
    MAILCHIMP_NEWSLETTER_LIST_ID,
} from "@ourworldindata/types"
import pMap from "p-map"
import pRetry from "p-retry"
import * as _ from "lodash-es"
import { MAILCHIMP_API_KEY } from "../../../settings/serverSettings.js"
import {
    MailchimpMemberState,
    MailchimpNewsletters,
} from "./mailchimpMigrationUtils.js"

/**
 * Minimal Mailchimp client for moving the RSS newsletters to email
 * notifications: reads the audience and its activity, and turns the
 * newsletters' interests on and off.
 */

// Interests of the "Newsletter" group that the two RSS campaigns send to.
const DATA_INSIGHTS_INTEREST_ID = "7f9fa4b5c4"
const ARTICLES_INTEREST_ID = "800640889b"

// The RSS campaigns themselves, for their send schedule.
const RSS_CAMPAIGN_IDS = {
    dataInsights: "77833dd717",
    articles: "f1f8dfe5c6",
}

// Mailchimp's maximum for list endpoints.
const PAGE_SIZE = 1000
// Mailchimp's maximum for batch member updates.
const MEMBER_UPDATE_CHUNK_SIZE = 500
// Mailchimp allows 10 simultaneous connections per key.
const CONCURRENCY = 4

class MailchimpApiError extends Error {
    constructor(
        message: string,
        readonly retryable: boolean
    ) {
        super(message)
        this.name = "MailchimpApiError"
    }
}

async function request<T>(
    method: "GET" | "POST",
    path: string,
    body?: object
): Promise<T> {
    if (!MAILCHIMP_API_KEY) throw new Error("MAILCHIMP_API_KEY is not set")
    const run = async (): Promise<T> => {
        let response: Response
        try {
            response = await fetch(
                `https://${MAILCHIMP_API_SERVER}.api.mailchimp.com/3.0/${path}`,
                {
                    method,
                    headers: {
                        Authorization: `Basic ${Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString("base64")}`,
                        "Content-Type": "application/json",
                    },
                    body: body && JSON.stringify(body),
                }
            )
        } catch (error) {
            throw new MailchimpApiError(
                `Mailchimp request failed: ${error}`,
                true
            )
        }
        if (!response.ok) {
            throw new MailchimpApiError(
                `Mailchimp request failed (${response.status}) path=${path.split("?")[0]}`,
                response.status === 429 || response.status >= 500
            )
        }
        return (await response.json()) as T
    }
    // Updating members is safe to repeat: it sets interests to fixed values.
    return pRetry(run, {
        retries: 5,
        minTimeout: 2000,
        randomize: true,
        shouldRetry: ({ error }) =>
            error instanceof MailchimpApiError && error.retryable,
    })
}

/** Fetch every page of a list endpoint. */
async function fetchAllPages<Page extends { total_items: number }>(
    path: string,
    params: Record<string, string>,
    onProgress?: (pagesDone: number, pageCount: number) => void
): Promise<Page[]> {
    const fetchPage = (offset: number): Promise<Page> =>
        request<Page>(
            "GET",
            `${path}?${new URLSearchParams({
                ...params,
                count: String(PAGE_SIZE),
                offset: String(offset),
            })}`
        )
    const firstPage = await fetchPage(0)
    const pageCount = Math.ceil(firstPage.total_items / PAGE_SIZE)
    let pagesDone = 1
    const otherPages = await pMap(
        _.range(1, pageCount),
        async (pageIndex) => {
            const page = await fetchPage(pageIndex * PAGE_SIZE)
            onProgress?.(++pagesDone, pageCount)
            return page
        },
        { concurrency: CONCURRENCY }
    )
    return [firstPage, ...otherPages]
}

export interface MailchimpMember extends MailchimpMemberState {
    email: string
    hasClicked: boolean
    optedInAt: Date | null
}

interface MembersPage {
    total_items: number
    members: {
        email_address: string
        interests?: Record<string, boolean>
        timestamp_opt?: string
        stats?: { avg_click_rate?: number }
    }[]
}

/**
 * Every subscribed member of the newsletter audience. Addresses that
 * unsubscribed, bounced or were removed are left out.
 */
export async function fetchSubscribedMembers(): Promise<MailchimpMember[]> {
    const pages = await fetchAllPages<MembersPage>(
        `lists/${MAILCHIMP_NEWSLETTER_LIST_ID}/members`,
        {
            status: "subscribed",
            fields: "total_items,members.email_address,members.interests,members.timestamp_opt,members.stats.avg_click_rate",
        },
        (pagesDone, pageCount) => {
            if (pagesDone % 10 === 0 || pagesDone === pageCount)
                console.log(
                    `Mailchimp members fetched pagesDone=${pagesDone}/${pageCount}`
                )
        }
    )
    const members = pages.flatMap((page) =>
        page.members.map((member) => ({
            email: member.email_address.trim().toLowerCase(),
            isSubscribed: true,
            dataInsights:
                member.interests?.[DATA_INSIGHTS_INTEREST_ID] === true,
            articles: member.interests?.[ARTICLES_INTEREST_ID] === true,
            hasClicked: (member.stats?.avg_click_rate ?? 0) > 0,
            optedInAt: member.timestamp_opt
                ? new Date(member.timestamp_opt)
                : null,
        }))
    )
    // Members can shift between pages while we're fetching them.
    return _.uniqBy(members, (member) => member.email)
}

interface ReportsPage {
    total_items: number
    reports: {
        id: string
        list_id: string
        emails_sent: number
        send_time: string
    }[]
}

/** Campaigns sent to the newsletter audience since the given time. */
export async function fetchSentCampaignIds(since: Date): Promise<string[]> {
    const pages = await fetchAllPages<ReportsPage>("reports", {
        since_send_time: since.toISOString(),
        fields: "total_items,reports.id,reports.list_id,reports.emails_sent,reports.send_time",
    })
    return pages
        .flatMap((page) => page.reports)
        .filter(
            (report) =>
                report.list_id === MAILCHIMP_NEWSLETTER_LIST_ID &&
                // Leave out test sends.
                report.emails_sent > 100
        )
        .map((report) => report.id)
}

export interface MailchimpOpens {
    lastOpenAt: Date | null
    /** Latest open that wasn't made by a mail privacy proxy. */
    lastRealOpenAt: Date | null
}

interface OpenDetailsPage {
    total_items: number
    members: {
        email_address: string
        opens?: { timestamp: string; is_proxy_open?: boolean }[]
    }[]
}

const laterOf = (a: Date | null, b: Date | null): Date | null =>
    !a || (b && b > a) ? b : a

/**
 * The latest opens of each address across the given campaigns. Slow: one
 * request per thousand opens of each campaign.
 */
export async function fetchLatestOpens(
    campaignIds: string[]
): Promise<Map<string, MailchimpOpens>> {
    const opensByEmail = new Map<string, MailchimpOpens>()
    for (const [index, campaignId] of campaignIds.entries()) {
        const pages = await fetchAllPages<OpenDetailsPage>(
            `reports/${campaignId}/open-details`,
            { fields: "total_items,members.email_address,members.opens" }
        )
        for (const member of pages.flatMap((page) => page.members)) {
            const email = member.email_address.trim().toLowerCase()
            let opens = opensByEmail.get(email) ?? {
                lastOpenAt: null,
                lastRealOpenAt: null,
            }
            for (const open of member.opens ?? []) {
                const openedAt = new Date(open.timestamp)
                opens = {
                    lastOpenAt: laterOf(opens.lastOpenAt, openedAt),
                    lastRealOpenAt: open.is_proxy_open
                        ? opens.lastRealOpenAt
                        : laterOf(opens.lastRealOpenAt, openedAt),
                }
            }
            opensByEmail.set(email, opens)
        }
        console.log(
            `Mailchimp campaign opens fetched campaignsDone=${index + 1}/${campaignIds.length}`
        )
    }
    return opensByEmail
}

/** The daily feed-check hour of each RSS campaign and its time zone. */
export async function fetchRssSchedule(): Promise<{
    timeZone: string
    hours: { dataInsights: number; articles: number }
}> {
    const fetchHour = async (campaignId: string): Promise<number> => {
        const campaign = await request<{
            rss_opts?: { frequency?: string; schedule?: { hour?: number } }
        }>("GET", `campaigns/${campaignId}?fields=rss_opts`)
        const hour = campaign.rss_opts?.schedule?.hour
        if (campaign.rss_opts?.frequency !== "daily" || hour === undefined)
            throw new Error(
                `Mailchimp campaign ${campaignId} is not a daily RSS campaign`
            )
        return hour
    }
    const [account, dataInsights, articles] = await Promise.all([
        request<{ account_timezone?: string }>(
            "GET",
            "?fields=account_timezone"
        ),
        fetchHour(RSS_CAMPAIGN_IDS.dataInsights),
        fetchHour(RSS_CAMPAIGN_IDS.articles),
    ])
    if (!account.account_timezone)
        throw new Error("Mailchimp didn't return the account time zone")
    return {
        timeZone: account.account_timezone,
        hours: { dataInsights, articles },
    }
}

interface MemberUpdateResponse {
    errors?: { email_address: string; error: string; error_code: string }[]
}

/**
 * Turn the given newsletters on or off for each address, leaving its other
 * interests (the OWID Brief) and its subscription status alone. Returns the
 * addresses Mailchimp didn't update.
 */
export async function setNewsletters(
    members: ({ email: string } & MailchimpNewsletters)[],
    enabled: boolean
): Promise<Set<string>> {
    const failedEmails = new Set<string>()
    for (const chunk of _.chunk(members, MEMBER_UPDATE_CHUNK_SIZE)) {
        const response = await request<MemberUpdateResponse>(
            "POST",
            `lists/${MAILCHIMP_NEWSLETTER_LIST_ID}`,
            {
                update_existing: true,
                members: chunk.map((member) => ({
                    email_address: member.email,
                    interests: {
                        ...(member.dataInsights && {
                            [DATA_INSIGHTS_INTEREST_ID]: enabled,
                        }),
                        ...(member.articles && {
                            [ARTICLES_INTEREST_ID]: enabled,
                        }),
                    },
                })),
            }
        )
        for (const error of response.errors ?? []) {
            failedEmails.add(error.email_address.trim().toLowerCase())
            console.error(
                `Mailchimp did not update a member errorCode=${error.error_code} error=${JSON.stringify(error.error)}`
            )
        }
    }
    return failedEmails
}
