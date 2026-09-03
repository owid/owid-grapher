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
    EmailNotificationsFrequency,
    LATEST_TYPE_LABELS,
    OwidEnrichedGdocBlock,
    Span,
} from "@ourworldindata/types"
import { formatAuthors } from "@ourworldindata/utils"
import {
    EmailNotificationsSubscriber,
    NotificationEmailItem,
    formatItemDate,
} from "./emailNotificationsUtils.js"

const COLORS = {
    background: "#f7f7f7",
    card: "#ffffff",
    cardMuted: "#ebeef2",
    navy: "#002147",
    text: "#1d3d63",
    muted: "#426591",
    headerText: "#a4b6ca",
    vermillion: "#ce261e",
}

const BODY_FONT = "Arial, Helvetica, sans-serif"
const SERIF_FONT = '"Times New Roman", serif'

const CONTAINER_WIDTH = 632
const CONTENT_PADDING = 40
const MOBILE_BREAKPOINT = 480
const MOBILE_CONTENT_PADDING = 16
const MOBILE_CARD_PADDING = 16

/**
 * The header image is a 1200x250 PNG, shown at the container width so it's
 * crisp on high-density screens. The width/height attributes state the
 * display size rather than the asset's because Outlook on Windows sizes
 * images by their attributes (ignoring CSS)
 */
const HEADER_IMAGE_WIDTH = CONTAINER_WIDTH
const HEADER_IMAGE_HEIGHT = Math.round((CONTAINER_WIDTH * 250) / 1200)
// Roughly the header's height on a ~400px-wide phone
const MOBILE_HEADER_IMAGE_HEIGHT = 80

// The inline styles win by default, so the mobile overrides need !important.
// Mobile clients (iOS Mail, Gmail app, Outlook mobile) honor <style> media
// queries; the ones that don't just keep the desktop padding.
const RESPONSIVE_STYLES = `
@media only screen and (max-width: ${MOBILE_BREAKPOINT}px) {
    .content {
        padding-left: ${MOBILE_CONTENT_PADDING}px !important;
        padding-right: ${MOBILE_CONTENT_PADDING}px !important;
    }
    .card {
        padding-left: ${MOBILE_CARD_PADDING}px !important;
        padding-right: ${MOBILE_CARD_PADDING}px !important;
    }
    .header-image {
        line-height: ${MOBILE_HEADER_IMAGE_HEIGHT}px !important;
    }
}
`

// react-email's <Text> defaults to 14px; the design's body copy is 16px/24px,
// so every body-copy element states it.
const BODY_TEXT: CSSProperties = { fontSize: 16, lineHeight: "24px" }

// react-email's <Link> defaults to a blue that a client shows on the alt text
// when it blocks the image, so links wrapping an image override it.
const IMAGE_LINK_STYLE: CSSProperties = {
    color: COLORS.text,
    textDecoration: "none",
}

const FREQUENCY_LABELS: Record<EmailNotificationsFrequency, string> = {
    daily: "daily",
    weekly: "weekly",
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
                <style>{RESPONSIVE_STYLES}</style>
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
                    <Header baseUrl={baseUrl} />
                    <Section
                        className="content"
                        style={{ padding: `32px ${CONTENT_PADDING}px 40px` }}
                    >
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

function Header({ baseUrl }: { baseUrl: string }) {
    return (
        <Section style={{ backgroundColor: COLORS.navy }}>
            {/* The header is an image so it gets the brand typeface in every
                client. Most clients render the alt text, styled by the img's
                own text styles, in its place when images are blocked; the
                navy background keeps it legible there, and the line-height
                matching the image height centers it vertically. */}
            <Link href={baseUrl} style={IMAGE_LINK_STYLE}>
                <Img
                    className="header-image"
                    src={`${baseUrl}/owid-email-header.png`}
                    alt="Our World in Data Update"
                    width={HEADER_IMAGE_WIDTH}
                    height={HEADER_IMAGE_HEIGHT}
                    style={{
                        display: "block",
                        width: "100%",
                        height: "auto",
                        backgroundColor: COLORS.navy,
                        fontFamily: BODY_FONT,
                        fontSize: 16,
                        lineHeight: `${HEADER_IMAGE_HEIGHT}px`,
                        fontWeight: 700,
                        color: "#ffffff",
                        textAlign: "center",
                    }}
                />
            </Link>
        </Section>
    )
}

function Item({ item, now }: { item: NotificationEmailItem; now: Date }) {
    return (
        <Section>
            <Kicker item={item} now={now} />
            {item.latestType === "data-insight" ? (
                <DataInsightCard item={item} />
            ) : item.latestType === "article" ? (
                <ArticleCard item={item} />
            ) : (
                <TeaserBody item={item} />
            )}
        </Section>
    )
}

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
                    {LATEST_TYPE_LABELS[item.latestType]}
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

function TeaserBody({ item }: { item: NotificationEmailItem }) {
    const body = item.body ?? []
    return (
        <>
            <ItemTitle item={item} />
            {body.map((block, index) => (
                <Block
                    key={index}
                    block={block}
                    imageUrlByFilename={item.imageUrlByFilename ?? {}}
                />
            ))}
            {body.length === 0 && (
                <>
                    {item.excerpt && (
                        <Text style={{ ...BODY_TEXT, margin: "0 0 8px" }}>
                            {item.excerpt}
                        </Text>
                    )}
                    <ReadMoreLink href={item.url} label="Read more" />
                </>
            )}
        </>
    )
}

function ArticleCard({ item }: { item: NotificationEmailItem }) {
    return (
        <Section
            className="card"
            style={{
                backgroundColor: COLORS.cardMuted,
                padding: "16px 16px 24px",
            }}
        >
            {item.thumbnailUrl && (
                <Link href={item.url} style={IMAGE_LINK_STYLE}>
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

function DataInsightCard({ item }: { item: NotificationEmailItem }) {
    const body = item.body ?? []
    // Render the image (which is by convention always first)
    const firstNonImage = body.findIndex((block) => block.type !== "image")
    const splitIndex = firstNonImage === -1 ? body.length : firstNonImage
    const imageUrlByFilename = item.imageUrlByFilename ?? {}
    return (
        <Section
            className="card"
            style={{ backgroundColor: COLORS.card, padding: 24 }}
        >
            {body.slice(0, splitIndex).map((block, index) => (
                <Block
                    key={index}
                    block={block}
                    imageUrlByFilename={imageUrlByFilename}
                    // The chart above the title links to the insight, as the
                    // title itself does.
                    imageHref={item.url}
                />
            ))}
            <ItemTitle item={item} />
            {item.authors.length > 0 && (
                <Text
                    style={{
                        ...BODY_TEXT,
                        color: COLORS.muted,
                        fontStyle: "italic",
                    }}
                >
                    {formatAuthors(item.authors)}
                </Text>
            )}
            {body.slice(splitIndex).map((block, index) => (
                <Block
                    key={index}
                    block={block}
                    imageUrlByFilename={imageUrlByFilename}
                />
            ))}
        </Section>
    )
}

/**
 * Render the subset of ArchieML blocks that data insight and announcement
 * bodies use by convention (image + text, occasionally a heading or list).
 * Other block types are skipped.
 */
function Block({
    block,
    imageUrlByFilename,
    imageHref,
}: {
    block: OwidEnrichedGdocBlock
    imageUrlByFilename: Record<string, string>
    /** When set, image blocks link here. */
    imageHref?: string
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
        case "list":
        case "numbered-list": {
            const ListTag = block.type === "list" ? "ul" : "ol"
            return (
                <ListTag
                    style={{
                        ...BODY_TEXT,
                        margin: "0 0 16px 24px",
                        padding: 0,
                        color: COLORS.text,
                    }}
                >
                    {block.items.map((item, index) => (
                        <li key={index} style={{ margin: "0 0 4px" }}>
                            <Spans spans={item.value} />
                        </li>
                    ))}
                </ListTag>
            )
        }
        case "cta":
            return (
                <Text style={{ ...BODY_TEXT, margin: "16px 0" }}>
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
            const image = (
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
            if (!imageHref) return image
            return (
                <Link href={imageHref} style={IMAGE_LINK_STYLE}>
                    {image}
                </Link>
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
            className="content"
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
                    Keep browsing
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
