import { CSSProperties, Fragment, ReactNode } from "react"
import {
    Body,
    Container,
    Column,
    Head,
    Heading,
    Html,
    Img,
    Link,
    Preview,
    Row,
    Section,
    Text,
    render,
} from "@react-email/components"
import {
    EmailNotificationsContentType,
    EmailNotificationsFrequency,
    OwidEnrichedGdocBlock,
    Span,
} from "@ourworldindata/types"
import { formatAuthors } from "@ourworldindata/utils"
import {
    EmailNotificationsSubscriber,
    NotificationEmailItem,
    formatItemDate,
} from "./emailNotificationsUtils.js"

// The notification email template, implementing the design in
// https://www.figma.com/design/tSJW2qxeaWwnfEXLmAfC5D/Subscribe?node-id=530-5592
//
// Email clients support a small, inconsistent subset of CSS, so this is built
// from react-email primitives (which compile to table-based markup with
// inlined styles) rather than reusing the site components. See
// docs/email-rendering-plan.md for the constraints this works within — in
// particular: no icon fonts or SVG, no flex/grid, absolute URLs only.

// Design tokens, from the Figma file's shared styles.
const COLORS = {
    background: "#f7f7f7", // Website/Background/Gray 5
    card: "#ffffff",
    cardMuted: "#ebeef2", // Website/Background/Blue 10
    navy: "#002147", // Website/Brand/Oxford Blue
    text: "#1d3d63", // Website/Text/Blue 90
    muted: "#426591", // Website/Text/Blue 60
    headerText: "#a4b6ca", // Website/Text/Blue 30
    vermillion: "#ce261e", // Website/Brand/Vermillion
}

const BODY_FONT = "Arial, Helvetica, sans-serif"
const SERIF_FONT = '"Times New Roman", serif'

const CONTAINER_WIDTH = 632
const CONTENT_PADDING = 40

// react-email's <Text> defaults to 14px; the design's body copy is 16px/24px,
// so every body-copy element states it.
const BODY_TEXT: CSSProperties = { fontSize: 16, lineHeight: "24px" }

/** Placeholder name — the newsletter hasn't been named yet. */
const EMAIL_NAME = { small: "Your", large: "OWID Update" }

const CONTENT_TYPE_LABELS: Record<EmailNotificationsContentType, string> = {
    article: "Article",
    "data-insight": "Data insight",
    "data-update": "Data update",
    announcement: "Announcement",
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

export interface NotificationEmailProps {
    subscriber: EmailNotificationsSubscriber
    items: NotificationEmailItem[]
    baseUrl: string
    apiBaseUrl: string
    /** Send time, against which item dates are formatted. */
    now: Date
}

/**
 * Render the email to the HTML and plain-text bodies Postmark is given. The
 * plain-text alternative is derived from the same component tree, and both
 * are sent: it improves spam scoring and serves text-only clients.
 */
export async function renderNotificationEmail(
    props: NotificationEmailProps
): Promise<{ html: string; text: string }> {
    const email = <NotificationEmail {...props} />
    const [html, text] = await Promise.all([
        render(email),
        render(email, { plainText: true }),
    ])
    return { html, text }
}

function NotificationEmail({
    subscriber,
    items,
    baseUrl,
    apiBaseUrl,
    now,
}: NotificationEmailProps) {
    const unsubscribeUrl = `${apiBaseUrl}/unsubscribe?token=${subscriber.token}`
    const updatePreferencesUrl = `${apiBaseUrl}/request-link?token=${subscriber.token}`
    return (
        <Html lang="en">
            <Head>
                <title>
                    {makeNotificationEmailSubject(subscriber.frequency)}
                </title>
            </Head>
            {/* Inbox preview text: the titles readers see next to the subject. */}
            <Preview>{items.map((item) => item.title).join(" · ")}</Preview>
            <Body
                style={{
                    margin: 0,
                    padding: 0,
                    backgroundColor: COLORS.background,
                    color: COLORS.text,
                    fontFamily: BODY_FONT,
                    fontSize: 16,
                    lineHeight: "24px",
                }}
            >
                <Container
                    style={{
                        width: "100%",
                        maxWidth: CONTAINER_WIDTH,
                        margin: "0 auto",
                        backgroundColor: COLORS.background,
                    }}
                >
                    <Header />
                    <Section
                        style={{ padding: `32px ${CONTENT_PADDING}px 40px` }}
                    >
                        <Text style={{ margin: "0 0 32px", fontSize: 14 }}>
                            Here is what we published in the last{" "}
                            {FREQUENCY_PERIODS[subscriber.frequency]} across the
                            topics you follow.{" "}
                            <Link
                                href={updatePreferencesUrl}
                                style={{
                                    color: COLORS.text,
                                    textDecoration: "underline",
                                }}
                            >
                                Update your preferences
                            </Link>{" "}
                            or, if this was forwarded to you,{" "}
                            <Link
                                href={`${baseUrl}/subscribe`}
                                style={{
                                    color: COLORS.text,
                                    textDecoration: "underline",
                                }}
                            >
                                subscribe here
                            </Link>
                            .
                        </Text>
                        {items.map((item, index) => (
                            <Fragment key={item.url}>
                                {index > 0 && <Spacer height={32} />}
                                <Item item={item} now={now} />
                            </Fragment>
                        ))}
                    </Section>
                    <Footer
                        email={subscriber.email}
                        baseUrl={baseUrl}
                        unsubscribeUrl={unsubscribeUrl}
                        updatePreferencesUrl={updatePreferencesUrl}
                    />
                </Container>
            </Body>
        </Html>
    )
}

/**
 * Vertical space between items. A spacer row rather than a margin, because
 * Outlook ignores margins on tables; the 1px font size stops the &nbsp; from
 * making the row taller than asked for.
 */
function Spacer({ height }: { height: number }) {
    return (
        <Section style={{ height, lineHeight: `${height}px`, fontSize: 1 }}>
            &nbsp;
        </Section>
    )
}

function Header() {
    return (
        <>
            <Section
                style={{
                    backgroundColor: COLORS.navy,
                    padding: `24px ${CONTENT_PADDING}px 28px`,
                }}
            >
                <Row>
                    <Column style={{ verticalAlign: "bottom" }}>
                        <Text
                            style={{
                                margin: 0,
                                fontFamily: SERIF_FONT,
                                fontWeight: 600,
                                fontSize: 18,
                                lineHeight: "24px",
                                color: COLORS.headerText,
                            }}
                        >
                            {EMAIL_NAME.small}
                        </Text>
                        <Text
                            style={{
                                margin: 0,
                                fontFamily: SERIF_FONT,
                                fontWeight: 600,
                                fontSize: 36,
                                lineHeight: "40px",
                                color: COLORS.headerText,
                            }}
                        >
                            {EMAIL_NAME.large}
                        </Text>
                    </Column>
                    <Column
                        style={{
                            width: 160,
                            verticalAlign: "bottom",
                            textAlign: "right",
                        }}
                    >
                        {/* The wordmark is set as text rather than an image so
                            it survives clients that block images. */}
                        <Text
                            style={{
                                margin: 0,
                                fontSize: 27,
                                lineHeight: "30px",
                                color: "#ffffff",
                                textAlign: "center",
                            }}
                        >
                            Our World
                            <br />
                            in Data
                        </Text>
                    </Column>
                </Row>
            </Section>
            <Section
                style={{
                    height: 5,
                    lineHeight: "5px",
                    backgroundColor: COLORS.vermillion,
                }}
            >
                &nbsp;
            </Section>
        </>
    )
}

function Item({ item, now }: { item: NotificationEmailItem; now: Date }) {
    return (
        <Section>
            <Kicker item={item} now={now} />
            {item.type === "data-insight" ? (
                <DataInsightCard item={item} />
            ) : item.type === "article" ? (
                <ArticleCard item={item} />
            ) : (
                <TeaserBody item={item} />
            )}
        </Section>
    )
}

/**
 * Metadata row above every item: type and topic on the left, date on the
 * right. The design pairs each with a FontAwesome icon; those can only be
 * images in email, and clients that block images leave a broken-image box in
 * the reserved space rather than collapsing it, so this is text-only.
 */
function Kicker({ item, now }: { item: NotificationEmailItem; now: Date }) {
    // The gap below the kicker sits on the paragraphs rather than the row,
    // because Outlook ignores margins on tables.
    const kickerStyle: CSSProperties = {
        margin: "0 0 8px",
        fontSize: 10,
        lineHeight: "16px",
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: COLORS.muted,
    }
    return (
        <Row>
            <Column>
                <Text style={kickerStyle}>
                    {CONTENT_TYPE_LABELS[item.type]}
                    {item.topicLabel && (
                        <>
                            {" — "}
                            <span style={{ color: COLORS.text }}>
                                {item.topicLabel}
                            </span>
                        </>
                    )}
                </Text>
            </Column>
            <Column style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <Text style={kickerStyle}>
                    {formatItemDate(item.publishedAt, now)}
                </Text>
            </Column>
        </Row>
    )
}

function ItemTitle({
    item,
    serif,
}: {
    item: NotificationEmailItem
    serif?: boolean
}) {
    return (
        <Heading
            as="h2"
            style={{
                margin: "0 0 8px",
                fontFamily: serif ? SERIF_FONT : BODY_FONT,
                fontSize: serif ? 24 : 20,
                lineHeight: serif ? "32px" : "24px",
                fontWeight: 700,
                color: COLORS.text,
            }}
        >
            <Link
                href={item.url}
                style={{ color: COLORS.text, textDecoration: "none" }}
            >
                {item.title}
            </Link>
        </Heading>
    )
}

function ReadMoreLink({ href, label }: { href: string; label: string }) {
    return (
        <Text style={{ ...BODY_TEXT, margin: 0 }}>
            <Link
                href={href}
                style={{
                    color: COLORS.vermillion,
                    fontWeight: 700,
                    textDecoration: "none",
                }}
            >
                {label} →
            </Link>
        </Text>
    )
}

/** Data updates and announcements: plain on the page background. */
function TeaserBody({ item }: { item: NotificationEmailItem }) {
    return (
        <>
            <ItemTitle item={item} />
            {item.excerpt && (
                <Text style={{ ...BODY_TEXT, margin: "0 0 8px" }}>
                    {item.excerpt}
                </Text>
            )}
            <ReadMoreLink href={item.url} label="Read more" />
        </>
    )
}

/** Articles: a tinted card with thumbnail, byline and excerpt. */
function ArticleCard({ item }: { item: NotificationEmailItem }) {
    return (
        <Section
            style={{
                backgroundColor: COLORS.cardMuted,
                padding: "16px 16px 24px",
            }}
        >
            {item.thumbnailUrl && (
                <Link href={item.url}>
                    <Img
                        src={item.thumbnailUrl}
                        alt=""
                        width={CONTAINER_WIDTH - 2 * CONTENT_PADDING - 32}
                        style={{
                            width: "100%",
                            height: "auto",
                            margin: "0 0 24px",
                        }}
                    />
                </Link>
            )}
            <ItemTitle item={item} serif />
            {item.authors.length > 0 && (
                <Text
                    style={{
                        ...BODY_TEXT,
                        margin: "0 0 8px",
                        fontStyle: "italic",
                        color: COLORS.muted,
                    }}
                >
                    {formatAuthors(item.authors)}
                </Text>
            )}
            {item.excerptBlocks ? (
                item.excerptBlocks.map((block, index) => (
                    <Text
                        key={index}
                        style={{ ...BODY_TEXT, margin: "0 0 16px" }}
                    >
                        <Spans spans={block.value} />
                    </Text>
                ))
            ) : item.excerpt ? (
                <Text style={{ ...BODY_TEXT, margin: "0 0 16px" }}>
                    {item.excerpt}
                </Text>
            ) : null}
            <ReadMoreLink href={item.url} label="Read the article" />
        </Section>
    )
}

/** Data insights ship their full content, like in the data insights feed. */
function DataInsightCard({ item }: { item: NotificationEmailItem }) {
    return (
        <Section style={{ backgroundColor: COLORS.card, padding: 24 }}>
            <ItemTitle item={item} />
            {(item.body ?? []).map((block, index) => (
                <Block
                    key={index}
                    block={block}
                    imageUrlByFilename={item.imageUrlByFilename ?? {}}
                />
            ))}
            {item.authors.length > 0 && (
                <Text
                    style={{
                        ...BODY_TEXT,
                        margin: "16px 0 0",
                        color: COLORS.muted,
                    }}
                >
                    By {formatAuthors(item.authors)}
                </Text>
            )}
        </Section>
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
                <Text style={{ ...BODY_TEXT, margin: "0 0 16px" }}>
                    <Spans spans={block.value} />
                </Text>
            )
        case "heading":
            return (
                <Heading
                    as="h3"
                    style={{
                        margin: "16px 0 8px",
                        fontFamily: BODY_FONT,
                        fontSize: 18,
                        lineHeight: "24px",
                        fontWeight: 700,
                        color: COLORS.text,
                    }}
                >
                    <Spans spans={block.text} />
                </Heading>
            )
        // Data insights end with a call to action linking to the chart or a
        // related article. The design gives it the emphasized treatment below.
        case "cta":
            return (
                <Text style={{ ...BODY_TEXT, margin: "16px 0 0" }}>
                    <Link
                        href={block.url}
                        style={{
                            color: COLORS.text,
                            fontWeight: 700,
                            textDecoration: "none",
                        }}
                    >
                        {block.text} →
                    </Link>
                </Text>
            )
        case "image": {
            const filename = block.preferSmallFilename
                ? (block.smallFilename ?? block.filename)
                : block.filename
            const url = imageUrlByFilename[filename]
            if (!url) return null
            return (
                <Img
                    src={url}
                    alt={block.alt ?? ""}
                    width={CONTAINER_WIDTH - 2 * CONTENT_PADDING - 48}
                    style={{
                        width: "100%",
                        height: "auto",
                        margin: "0 0 16px",
                        border: `1px solid ${COLORS.cardMuted}`,
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
                <Link
                    href={span.url}
                    style={{
                        color: "inherit",
                        textDecoration: "underline",
                    }}
                >
                    <Spans spans={span.children} />
                </Link>
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
    baseUrl,
    unsubscribeUrl,
    updatePreferencesUrl,
}: {
    email: string
    baseUrl: string
    unsubscribeUrl: string
    updatePreferencesUrl: string
}) {
    const footerTextStyle: CSSProperties = {
        margin: "0 0 8px",
        fontSize: 13,
        lineHeight: "20px",
        color: COLORS.muted,
        textAlign: "center",
    }
    const footerLinkStyle: CSSProperties = {
        color: COLORS.muted,
        textDecoration: "underline",
    }
    return (
        <Section
            style={{
                padding: `0 ${CONTENT_PADDING}px 40px`,
                textAlign: "center",
            }}
        >
            <Text
                style={{
                    ...BODY_TEXT,
                    margin: "0 0 24px",
                    textAlign: "center",
                }}
            >
                <Link
                    href={`${baseUrl}/latest`}
                    style={{
                        display: "inline-block",
                        padding: "12px 24px",
                        backgroundColor: COLORS.navy,
                        color: "#ffffff",
                        fontWeight: 700,
                        textDecoration: "none",
                    }}
                >
                    Browse the latest on Our World in Data
                </Link>
            </Text>
            <Text style={footerTextStyle}>
                This email was sent to {email} because you subscribed to email
                updates from Our World in Data.
            </Text>
            <Text style={footerTextStyle}>
                You can{" "}
                <Link href={updatePreferencesUrl} style={footerLinkStyle}>
                    update your preferences
                </Link>{" "}
                or{" "}
                <Link href={unsubscribeUrl} style={footerLinkStyle}>
                    unsubscribe
                </Link>{" "}
                at any time.
            </Text>
            <Text style={{ ...footerTextStyle, marginBottom: 0 }}>
                Our World in Data · Global Change Data Lab · Oxford, United
                Kingdom
            </Text>
        </Section>
    )
}
