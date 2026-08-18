import { expect, it, describe } from "vitest"
import { BlockSize, EnrichedBlockText, Span } from "@ourworldindata/types"
import {
    EmailNotificationsSubscriber,
    NotificationEmailItem,
} from "./emailNotificationsUtils.js"
import { renderNotificationEmail } from "./NotificationEmail.js"

const NOW = new Date("2026-08-07T06:00:00Z")

const BASE_URL = "https://ourworldindata.org"
const API_BASE_URL = `${BASE_URL}/api/email-notifications`

const SUBSCRIBER: EmailNotificationsSubscriber = {
    userId: 1,
    email: "reader@example.com",
    token: "user-token",
    topicTags: [],
    contentTypes: ["article", "data-insight", "data-update", "announcement"],
    frequency: "weekly",
    lastSentAt: null,
}

const simpleText = (text: string): Span => ({
    spanType: "span-simple-text",
    text,
})

const textBlock = (spans: Span[]): EnrichedBlockText => ({
    type: "text",
    value: spans,
    parseErrors: [],
})

/** One item of each content type, exercising every branch of the template. */
const ITEMS: NotificationEmailItem[] = [
    {
        type: "data-update",
        slug: "guinea-worm",
        title: "How close is the world to eradicating guinea worm disease?",
        url: `${BASE_URL}/guinea-worm`,
        publishedAt: new Date("2026-08-06T09:00:00Z"),
        topicNames: ["Health"],
        topicLabel: "Health",
        authors: ["Saloni Dattani"],
        excerpt: "Guinea worm disease is a painful parasitic infection.",
        // Published data updates run to several paragraphs and end with a cta
        // block, and the email carries all of it.
        body: [
            textBlock([
                simpleText("Cases have fallen from 3.5 million a year."),
            ]),
            textBlock([simpleText("Only a handful of cases remain.")]),
            textBlock([simpleText("The last cases are the hardest to reach.")]),
            {
                type: "cta",
                text: "Explore our data on guinea worm",
                url: `${BASE_URL}/grapher/guinea-worm-cases`,
                parseErrors: [],
            },
            {
                type: "image",
                filename: "guinea-worm.png",
                alt: "Reported guinea worm cases since 1986",
                size: BlockSize.Wide,
                hasOutline: true,
                parseErrors: [],
            },
        ],
        imageUrlByFilename: {
            "guinea-worm.png": "https://images.ourworldindata.org/ghi/w=1200",
        },
    },
    {
        type: "data-insight",
        slug: "cereal-yields",
        title: "Cereal yields have increased in all regions",
        url: `${BASE_URL}/data-insights/cereal-yields`,
        publishedAt: new Date("2026-08-05T09:00:00Z"),
        topicNames: ["Food and Agriculture"],
        topicLabel: "Food and Agriculture",
        authors: ["Hannah Ritchie"],
        // Data insights lead with their chart image, as every published one
        // does, and end with a cta.
        body: [
            {
                type: "image",
                filename: "cereal-yields.png",
                alt: "Cereal yields by region",
                size: BlockSize.Wide,
                hasOutline: true,
                parseErrors: [],
            },
            textBlock([
                simpleText("Global yields of cereal crops have tripled since "),
                {
                    spanType: "span-link",
                    url: `${BASE_URL}/crop-yields`,
                    children: [simpleText("1961")],
                },
                simpleText("."),
            ]),
            {
                type: "cta",
                text: "Explore this data in our interactive chart",
                url: `${BASE_URL}/grapher/cereal-yields`,
                parseErrors: [],
            },
        ],
        imageUrlByFilename: {
            "cereal-yields.png": "https://images.ourworldindata.org/abc/w=1200",
        },
    },
    {
        type: "article",
        slug: "deforestation-drivers",
        title: "What has driven deforestation in the 21st century?",
        url: `${BASE_URL}/deforestation-drivers`,
        publishedAt: new Date("2026-08-03T09:00:00Z"),
        topicNames: ["Energy and Environment"],
        topicLabel: "Energy and Environment",
        authors: ["Hannah Ritchie"],
        excerpt: "The largest cause of deforestation is farmland expansion.",
        // An authored latest-feed-excerpt takes precedence over `excerpt`.
        excerptBlocks: [
            textBlock([
                { spanType: "span-bold", children: [simpleText("Beef")] },
                simpleText(" was by far the largest driver of deforestation."),
            ]),
            textBlock([
                simpleText("The second-largest was "),
                // Links arrive already resolved to public URLs (see
                // excerptLinks.ts).
                {
                    spanType: "span-link",
                    url: `${BASE_URL}/palm-oil`,
                    children: [simpleText("oilseeds")],
                },
                simpleText("."),
            ]),
        ],
        thumbnailUrl: "https://images.ourworldindata.org/def/w=1200",
    },
    {
        // Announcements are usually untagged, so this one has no topic label
        // and, being an announcement, no thumbnail either.
        type: "announcement",
        slug: "new-site-search",
        title: "We've rebuilt our site search",
        url: `${BASE_URL}/new-site-search`,
        publishedAt: new Date("2026-08-01T09:00:00Z"),
        topicNames: [],
        authors: [],
        excerpt: "Finding a chart on our site should now be much faster.",
        // No closing cta, so this one's only link out is its title.
        body: [
            textBlock([simpleText("Finding a chart should now be faster.")]),
            textBlock([simpleText("Results are grouped by content type.")]),
        ],
    },
]

const renderFixture = (items = ITEMS) =>
    renderNotificationEmail({
        subscriber: SUBSCRIBER,
        items,
        baseUrl: BASE_URL,
        apiBaseUrl: API_BASE_URL,
        now: NOW,
    })

describe(renderNotificationEmail, () => {
    it("renders every content type", async () => {
        const { html } = await renderFixture()
        expect(html).toMatchSnapshot()
    })

    it("renders the plain-text alternative", async () => {
        const { text } = await renderFixture()
        expect(text).toMatchSnapshot()
    })

    it("includes the subscriber's unsubscribe and preferences links", async () => {
        const { html, text } = await renderFixture()
        for (const body of [html, text]) {
            expect(body).toContain(
                `${API_BASE_URL}/unsubscribe?token=${SUBSCRIBER.token}`
            )
            expect(body).toContain(
                `${API_BASE_URL}/request-link?token=${SUBSCRIBER.token}`
            )
            expect(body).toContain(SUBSCRIBER.email)
        }
    })

    it("prefers an article's authored excerpt over the derived one", async () => {
        const { html } = await renderFixture()
        expect(html).toContain(
            "was by far the largest driver of deforestation."
        )
        expect(html).not.toContain(
            "The largest cause of deforestation is farmland expansion."
        )
        // Links the excerpt carries survive into the email.
        expect(html).toContain(`href="${BASE_URL}/palm-oil"`)
    })

    it("shows an announcement's whole body, not its excerpt", async () => {
        const { html } = await renderFixture()
        expect(html).toContain("Cases have fallen from 3.5 million a year.")
        expect(html).toContain("Only a handful of cases remain.")
        expect(html).toContain("The last cases are the hardest to reach.")
        // Its closing cta block carries the link out, so nothing else does.
        expect(html).toMatch(/Explore our data on guinea worm[\s\S]{0,40}→/)
        expect(html).toContain("https://images.ourworldindata.org/ghi/w=1200")
        expect(html).not.toContain(
            "Guinea worm disease is a painful parasitic infection."
        )
        expect(html).not.toContain("Read more")
    })

    it("falls back to the excerpt for an announcement with no body", async () => {
        const { html } = await renderFixture([
            {
                type: "announcement",
                slug: "cta-only",
                title: "An announcement that is only a call to action",
                url: `${BASE_URL}/cta-only`,
                publishedAt: new Date("2026-08-02T09:00:00Z"),
                topicNames: [],
                authors: [],
                excerpt: "Pre-order our book.",
            },
        ])
        expect(html).toContain("Pre-order our book.")
        expect(html).toMatch(/Read more[\s\S]{0,40}→/)
    })

    it("puts a data insight's chart above its title", async () => {
        const { html } = await renderFixture()
        const imageIndex = html.indexOf(
            "https://images.ourworldindata.org/abc/w=1200",
            html.indexOf("<!--body-->")
        )
        const titleIndex = html.indexOf(
            "Cereal yields have increased in all regions",
            html.indexOf("<!--body-->")
        )
        expect(imageIndex).toBeGreaterThan(-1)
        expect(imageIndex).toBeLessThan(titleIndex)
    })

    it("renders the data insight's cta block with the arrow treatment", async () => {
        const { html } = await renderFixture()
        expect(html).toMatch(
            /Explore this data in our interactive chart[\s\S]{0,40}→/
        )
    })

    it("leaves no undefined or NaN values in the output", async () => {
        const { html, text } = await renderFixture()
        for (const body of [html, text]) {
            expect(body).not.toMatch(/undefined|NaN|\[object Object\]/)
        }
    })

    it("omits optional item fields that are missing", async () => {
        const { html } = await renderFixture([
            {
                type: "article",
                slug: "bare",
                title: "An article with nothing optional set",
                url: `${BASE_URL}/bare`,
                publishedAt: new Date("2026-08-02T09:00:00Z"),
                topicNames: [],
                authors: [],
            },
        ])
        expect(html).toContain("An article with nothing optional set")
        expect(html).not.toContain("<img")
    })

    it("stays well clear of Gmail's ~102KB clipping threshold", async () => {
        const { html } = await renderFixture()
        const bytes = Buffer.byteLength(html)
        console.log(`Rendered fixture email: ${bytes} bytes of HTML`)
        expect(bytes).toBeLessThan(102 * 1024)
    })
})
