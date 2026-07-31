import ReactDOMServer from "react-dom/server"
import { CSSProperties, Fragment, ReactNode } from "react"
import {
    EmailNotificationsFrequency,
    OwidEnrichedGdocBlock,
    OwidGdocType,
    Span,
} from "@ourworldindata/types"
import { dayjs, formatAuthors } from "@ourworldindata/utils"
import {
    EmailNotificationsSubscriber,
    LatestFeedType,
    NotificationEmailItem,
} from "./emailNotificationsUtils.js"

// Hardcoded email template for the notification emails (an email template
// editor is out of scope for this project). Emails need inline styles and
// simple markup, so this deliberately doesn't reuse the site components.

const COLORS = {
    background: "#fbf9f3",
    card: "#ffffff",
    navy: "#002147",
    blue: "#1d3d63",
    text: "#2d2e2d",
    muted: "#616161",
    accent: "#cf1918",
    border: "#e7e7e7",
}

const BODY_FONT = 'Lato, "Helvetica Neue", Helvetica, Arial, sans-serif'
const SERIF_FONT = '"Playfair Display", Georgia, "Times New Roman", serif'

const CONTENT_TYPE_LABELS: Record<LatestFeedType, string> = {
    [OwidGdocType.Article]: "Article",
    [OwidGdocType.DataInsight]: "Data insight",
    [OwidGdocType.Announcement]: "Announcement",
}

const FREQUENCY_LABELS: Record<EmailNotificationsFrequency, string> = {
    daily: "daily",
    weekly: "weekly",
}

const FREQUENCY_PERIODS: Record<EmailNotificationsFrequency, string> = {
    daily: "day",
    weekly: "week",
}

export function makeNotificationEmailSubject(
    frequency: EmailNotificationsFrequency
): string {
    return `Your ${FREQUENCY_LABELS[frequency]} update from Our World in Data`
}

export function renderNotificationEmail(props: {
    subscriber: EmailNotificationsSubscriber
    items: NotificationEmailItem[]
    baseUrl: string
    apiBaseUrl: string
}): string {
    return (
        "<!doctype html>" +
        ReactDOMServer.renderToStaticMarkup(<NotificationEmail {...props} />)
    )
}

function NotificationEmail({
    subscriber,
    items,
    baseUrl,
    apiBaseUrl,
}: {
    subscriber: EmailNotificationsSubscriber
    items: NotificationEmailItem[]
    baseUrl: string
    apiBaseUrl: string
}) {
    const unsubscribeUrl = `${apiBaseUrl}/unsubscribe?token=${subscriber.token}`
    const updatePreferencesUrl = `${apiBaseUrl}/request-link?token=${subscriber.token}`
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <title>
                    {makeNotificationEmailSubject(subscriber.frequency)}
                </title>
            </head>
            <body
                style={{
                    margin: 0,
                    padding: "24px 0",
                    backgroundColor: COLORS.background,
                    color: COLORS.text,
                    fontFamily: BODY_FONT,
                    fontSize: 16,
                    lineHeight: 1.5,
                }}
            >
                <div
                    style={{
                        maxWidth: 600,
                        margin: "0 auto",
                        backgroundColor: COLORS.card,
                    }}
                >
                    <Header frequency={subscriber.frequency} />
                    <div style={{ padding: "8px 24px 24px" }}>
                        <p>
                            Here's what we published in the last{" "}
                            {FREQUENCY_PERIODS[subscriber.frequency]} across the
                            topics you follow. You can{" "}
                            <a
                                href={unsubscribeUrl}
                                style={{ color: COLORS.blue }}
                            >
                                unsubscribe
                            </a>{" "}
                            at any time, or, if this was forwarded to you,{" "}
                            <a
                                href={`${baseUrl}/subscribe`}
                                style={{ color: COLORS.blue }}
                            >
                                subscribe here
                            </a>
                            .
                        </p>
                        {items.map((item, index) => (
                            <Fragment key={item.url}>
                                {index > 0 && (
                                    <hr
                                        style={{
                                            border: "none",
                                            borderTop: `1px solid ${COLORS.border}`,
                                            margin: "24px 0",
                                        }}
                                    />
                                )}
                                <Item item={item} />
                            </Fragment>
                        ))}
                        <p style={{ marginTop: 32, textAlign: "center" }}>
                            <a
                                href={`${baseUrl}/latest`}
                                style={{
                                    display: "inline-block",
                                    padding: "10px 24px",
                                    backgroundColor: COLORS.blue,
                                    color: "#ffffff",
                                    textDecoration: "none",
                                }}
                            >
                                Browse the latest on Our World in Data
                            </a>
                        </p>
                    </div>
                    <Footer
                        email={subscriber.email}
                        unsubscribeUrl={unsubscribeUrl}
                        updatePreferencesUrl={updatePreferencesUrl}
                    />
                </div>
            </body>
        </html>
    )
}

function Header({ frequency }: { frequency: EmailNotificationsFrequency }) {
    return (
        <table
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            style={{
                backgroundColor: COLORS.navy,
                borderBottom: `3px solid ${COLORS.accent}`,
            }}
        >
            <tbody>
                <tr>
                    <td style={{ padding: "20px 24px" }}>
                        <span
                            style={{
                                fontFamily: SERIF_FONT,
                                fontSize: 24,
                                color: "#ffffff",
                            }}
                        >
                            Your {FREQUENCY_LABELS[frequency]} update
                        </span>
                    </td>
                    <td
                        style={{
                            padding: "20px 24px",
                            textAlign: "right",
                            verticalAlign: "middle",
                        }}
                    >
                        <span
                            style={{
                                color: "#ffffff",
                                fontWeight: 700,
                                fontSize: 15,
                            }}
                        >
                            Our World
                            <br />
                            in Data
                        </span>
                    </td>
                </tr>
            </tbody>
        </table>
    )
}

function Item({ item }: { item: NotificationEmailItem }) {
    return (
        <div>
            <Kicker item={item} />
            <h2
                style={{
                    fontFamily: SERIF_FONT,
                    fontSize: 22,
                    lineHeight: 1.3,
                    color: COLORS.navy,
                    margin: "0 0 8px",
                }}
            >
                <a
                    href={item.url}
                    style={{ color: COLORS.navy, textDecoration: "none" }}
                >
                    {item.title}
                </a>
            </h2>
            {item.type === OwidGdocType.DataInsight ? (
                <DataInsightBody item={item} />
            ) : (
                <TeaserBody item={item} />
            )}
        </div>
    )
}

function Kicker({ item }: { item: NotificationEmailItem }) {
    const kickerStyle: CSSProperties = {
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: COLORS.muted,
    }
    return (
        <table width="100%" cellPadding={0} cellSpacing={0}>
            <tbody>
                <tr>
                    <td style={{ ...kickerStyle, padding: "0 0 8px" }}>
                        {CONTENT_TYPE_LABELS[item.type]}
                        {item.topicLabel ? ` — ${item.topicLabel}` : null}
                    </td>
                    <td
                        style={{
                            ...kickerStyle,
                            padding: "0 0 8px",
                            textAlign: "right",
                        }}
                    >
                        {dayjs(item.publishedAt).format("MMM D")}
                    </td>
                </tr>
            </tbody>
        </table>
    )
}

/** Lean treatment for articles and announcements: excerpt + link. */
function TeaserBody({ item }: { item: NotificationEmailItem }) {
    return (
        <div>
            {item.authors.length > 0 && (
                <p
                    style={{
                        margin: "0 0 8px",
                        fontStyle: "italic",
                        color: COLORS.muted,
                    }}
                >
                    {formatAuthors(item.authors)}
                </p>
            )}
            {item.thumbnailUrl && (
                <a href={item.url}>
                    <img
                        src={item.thumbnailUrl}
                        alt=""
                        width={552}
                        style={{
                            width: "100%",
                            height: "auto",
                            margin: "8px 0",
                        }}
                    />
                </a>
            )}
            {item.excerpt && (
                <p style={{ margin: "0 0 8px" }}>{item.excerpt}</p>
            )}
            <p style={{ margin: 0 }}>
                <a href={item.url} style={{ color: COLORS.blue }}>
                    {item.type === OwidGdocType.Article
                        ? "Read the article →"
                        : "Read more →"}
                </a>
            </p>
        </div>
    )
}

/** Data insights ship their full content, like in the Data Insights newsletter. */
function DataInsightBody({ item }: { item: NotificationEmailItem }) {
    return (
        <div>
            {(item.body ?? []).map((block, index) => (
                <Block
                    key={index}
                    block={block}
                    imageUrlByFilename={item.imageUrlByFilename ?? {}}
                />
            ))}
            {item.authors.length > 0 && (
                <p style={{ margin: "8px 0 0", color: COLORS.muted }}>
                    By {formatAuthors(item.authors)}
                </p>
            )}
        </div>
    )
}

/**
 * Render the subset of ArchieML blocks that data insight bodies use by
 * convention (image + text, occasionally a heading). Other block types are
 * skipped.
 */
function Block({
    block,
    imageUrlByFilename,
}: {
    block: OwidEnrichedGdocBlock
    imageUrlByFilename: Record<string, string>
}): ReactNode {
    switch (block.type) {
        case "text":
            return (
                <p style={{ margin: "0 0 12px" }}>
                    <Spans spans={block.value} />
                </p>
            )
        case "heading":
            return (
                <h3
                    style={{
                        fontFamily: SERIF_FONT,
                        fontSize: 18,
                        color: COLORS.navy,
                        margin: "16px 0 8px",
                    }}
                >
                    <Spans spans={block.text} />
                </h3>
            )
        case "image": {
            const filename = block.preferSmallFilename
                ? (block.smallFilename ?? block.filename)
                : block.filename
            const url = imageUrlByFilename[filename]
            if (!url) return null
            return (
                <img
                    src={url}
                    alt={block.alt ?? ""}
                    width={552}
                    style={{
                        width: "100%",
                        height: "auto",
                        margin: "8px 0 12px",
                    }}
                />
            )
        }
        default:
            return null
    }
}

function Spans({ spans }: { spans: Span[] }): ReactNode {
    return spans.map((span, index) => <SpanElement key={index} span={span} />)
}

function SpanElement({ span }: { span: Span }): ReactNode {
    switch (span.spanType) {
        case "span-simple-text":
            return span.text
        case "span-newline":
            return <br />
        case "span-link":
        case "span-ref":
            return (
                <a href={span.url} style={{ color: COLORS.blue }}>
                    <Spans spans={span.children} />
                </a>
            )
        case "span-bold":
            return (
                <b>
                    <Spans spans={span.children} />
                </b>
            )
        case "span-italic":
            return (
                <i>
                    <Spans spans={span.children} />
                </i>
            )
        case "span-underline":
            return (
                <u>
                    <Spans spans={span.children} />
                </u>
            )
        case "span-subscript":
            return (
                <sub>
                    <Spans spans={span.children} />
                </sub>
            )
        case "span-superscript":
            return (
                <sup>
                    <Spans spans={span.children} />
                </sup>
            )
        // Spans that render as plain text in emails (details on demand,
        // guided chart links, etc. only work on the site).
        case "span-quote":
        case "span-dod":
        case "span-guided-chart-link":
        case "span-callout":
        case "span-fallback":
            return <Spans spans={span.children} />
        default:
            return null
    }
}

function Footer({
    email,
    unsubscribeUrl,
    updatePreferencesUrl,
}: {
    email: string
    unsubscribeUrl: string
    updatePreferencesUrl: string
}) {
    const footerTextStyle: CSSProperties = {
        margin: "0 0 8px",
        fontSize: 13,
        color: COLORS.muted,
        textAlign: "center",
    }
    return (
        <div
            style={{
                padding: "16px 24px 24px",
                borderTop: `1px solid ${COLORS.border}`,
            }}
        >
            <p style={footerTextStyle}>
                This email was sent to {email} because you subscribed to email
                updates from Our World in Data.
            </p>
            <p style={footerTextStyle}>
                You can{" "}
                <a href={updatePreferencesUrl} style={{ color: COLORS.blue }}>
                    update your preferences
                </a>{" "}
                or{" "}
                <a href={unsubscribeUrl} style={{ color: COLORS.blue }}>
                    unsubscribe
                </a>{" "}
                at any time.
            </p>
            <p style={{ ...footerTextStyle, marginBottom: 0 }}>
                Our World in Data · Global Change Data Lab · Oxford, United
                Kingdom
            </p>
        </div>
    )
}
