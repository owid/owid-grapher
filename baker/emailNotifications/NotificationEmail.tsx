import { CSSProperties, Fragment, ReactNode } from "react"
import {
    Column,
    Heading,
    Img,
    Link,
    Row,
    Section,
    Text,
} from "@react-email/components"
import {
    BODY_FONT,
    BODY_TEXT,
    COLORS,
    CONTAINER_WIDTH,
    CONTENT_PADDING,
    EmailButton,
    EmailContent,
    EmailFooter,
    EmailLayout,
    FOOTER_LINK_STYLE,
    FOOTER_TEXT_STYLE,
    IMAGE_LINK_STYLE,
    Spacer,
} from "./EmailLayout.js"
import { RenderedEmail, renderEmail } from "./renderEmail.js"
import {
    LATEST_TYPE_LABELS,
    OwidEnrichedGdocBlock,
    Span,
} from "@ourworldindata/types"
import { formatAuthors } from "@ourworldindata/utils"
import { splitLeadImage } from "../../site/latest/latestUtils.js"
import {
    EmailNotificationsSubscriber,
    NotificationEmailItem,
    formatItemDate,
} from "./emailNotificationsUtils.js"

/**
 * Leads with what's new rather than a generic "update", which reads like a
 * terms-of-service notice and gets cut off on mobile.
 */
export function makeNotificationEmailSubject(
    items: Pick<NotificationEmailItem, "title">[]
): string {
    const [first, ...rest] = items
    // Only the admin preview renders an email with no items.
    if (!first) return "New on OWID"
    if (rest.length === 0) return first.title
    return `New on OWID: ${first.title} and ${rest.length} more`
}

export interface NotificationEmailProps {
    subscriber: EmailNotificationsSubscriber
    items: NotificationEmailItem[]
    baseUrl: string
    apiBaseUrl: string
    /** Send time, against which item dates are formatted. */
    now: Date
}

export function renderNotificationEmail(
    props: NotificationEmailProps
): Promise<RenderedEmail> {
    return renderEmail(
        makeNotificationEmailSubject(props.items),
        <NotificationEmail {...props} />
    )
}

function NotificationEmail({
    subscriber,
    items,
    baseUrl,
    apiBaseUrl,
    now,
}: NotificationEmailProps) {
    const updatePreferencesUrl = `${apiBaseUrl}/request-link?token=${subscriber.token}`
    return (
        <EmailLayout
            title={makeNotificationEmailSubject(items)}
            preview={items.map((item) => item.title).join(" · ")}
            baseUrl={baseUrl}
            header="update"
        >
            <EmailContent>
                {items.map((item, index) => (
                    <Fragment key={item.url}>
                        {index > 0 && <Spacer height={32} />}
                        <Item item={item} now={now} />
                    </Fragment>
                ))}
            </EmailContent>
            <Footer
                email={subscriber.email}
                baseUrl={baseUrl}
                updatePreferencesUrl={updatePreferencesUrl}
            />
        </EmailLayout>
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
            <Column style={{ verticalAlign: "top" }}>
                <Text style={kickerStyle}>
                    {LATEST_TYPE_LABELS[item.latestType]}
                    {item.topicLabel && (
                        <>
                            {" – "}
                            <span style={{ color: COLORS.text }}>
                                {item.topicLabel}
                            </span>
                        </>
                    )}
                </Text>
            </Column>
            <Column
                style={{
                    textAlign: "right",
                    whiteSpace: "nowrap",
                    verticalAlign: "top",
                    paddingLeft: 12,
                }}
            >
                <Text style={kickerStyle}>
                    {formatItemDate(item.publishedAt, now)}
                </Text>
            </Column>
        </Row>
    )
}

function ItemTitle({ item }: { item: NotificationEmailItem }) {
    return (
        <Heading
            as="h2"
            style={{
                margin: "0 0 8px",
                fontFamily: BODY_FONT,
                fontSize: 20,
                lineHeight: "24px",
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

function ItemAuthors({
    item,
    hasBlocksBelow = false,
}: {
    item: NotificationEmailItem
    hasBlocksBelow?: boolean
}) {
    if (item.authors.length === 0) return null
    return (
        <Text
            style={{
                ...BODY_TEXT,
                margin: hasBlocksBelow ? "0 0 16px" : 0,
                fontStyle: "italic",
                color: COLORS.muted,
            }}
        >
            {formatAuthors(item.authors)}
        </Text>
    )
}

function ReadMoreLink({
    href,
    label,
    hasBylineBelow,
}: {
    href: string
    label: string
    hasBylineBelow: boolean
}) {
    return (
        <Text
            style={{
                ...BODY_TEXT,
                margin: hasBylineBelow ? "0 0 16px" : 0,
            }}
        >
            <Link
                href={href}
                style={{
                    color: COLORS.vermillion,
                    fontWeight: 700,
                    textDecoration: "none",
                }}
            >
                <u>{label}</u> →
            </Link>
        </Text>
    )
}

/**
 * Put the byline just before the body's last image, or at the end when it
 * has none, matching an announcement's layout on /latest
 * (AnnouncementContent.scss)
 */
function splitBeforeLastImage(blocks: OwidEnrichedGdocBlock[]): {
    beforeByline: OwidEnrichedGdocBlock[]
    afterByline: OwidEnrichedGdocBlock[]
} {
    const lastImage = blocks.findLastIndex((block) => block.type === "image")
    const index = lastImage === -1 ? blocks.length : lastImage
    return {
        beforeByline: blocks.slice(0, index),
        afterByline: blocks.slice(index),
    }
}

function TeaserBody({ item }: { item: NotificationEmailItem }) {
    const imageUrlsByFilename = item.imageUrlsByFilename ?? {}
    // A data update leads with its chart, as on /latest
    const { leadImage, rest: body } =
        item.latestType === "data-update"
            ? splitLeadImage(item.body ?? [])
            : { leadImage: undefined, rest: item.body ?? [] }
    const { beforeByline, afterByline } = splitBeforeLastImage(body)
    return (
        <>
            {leadImage && (
                <Block
                    block={leadImage}
                    imageUrlsByFilename={imageUrlsByFilename}
                    imageHref={item.url}
                />
            )}
            <ItemTitle item={item} />
            {beforeByline.map((block, index) => (
                <Block
                    key={index}
                    block={block}
                    imageUrlsByFilename={imageUrlsByFilename}
                />
            ))}
            {body.length === 0 && (
                <>
                    {item.excerpt && (
                        <Text style={{ ...BODY_TEXT, margin: "0 0 8px" }}>
                            {item.excerpt}
                        </Text>
                    )}
                    <ReadMoreLink
                        href={item.url}
                        label="Read more"
                        hasBylineBelow={item.authors.length > 0}
                    />
                </>
            )}
            <ItemAuthors item={item} hasBlocksBelow={afterByline.length > 0} />
            {afterByline.map((block, index) => (
                <Block
                    key={index}
                    block={block}
                    imageUrlsByFilename={imageUrlsByFilename}
                />
            ))}
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
            <ItemTitle item={item} />
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
            <ReadMoreLink
                href={item.url}
                label="Read the article"
                hasBylineBelow={item.authors.length > 0}
            />
            <ItemAuthors item={item} />
        </Section>
    )
}

function DataInsightCard({ item }: { item: NotificationEmailItem }) {
    const { leadImage, rest } = splitLeadImage(item.body ?? [])
    const imageUrlsByFilename = item.imageUrlsByFilename ?? {}
    return (
        <Section
            className="card"
            style={{ backgroundColor: COLORS.card, padding: 24 }}
        >
            {leadImage && (
                <Block
                    block={leadImage}
                    imageUrlsByFilename={imageUrlsByFilename}
                    // The chart above the title links to the insight, as the
                    // title itself does.
                    imageHref={item.url}
                />
            )}
            <ItemTitle item={item} />
            {rest.map((block, index) => (
                <Block
                    key={index}
                    block={block}
                    imageUrlsByFilename={imageUrlsByFilename}
                />
            ))}
            <ItemAuthors item={item} />
        </Section>
    )
}

const EMAIL_BLOCK_TYPES = [
    "text",
    "heading",
    "list",
    "numbered-list",
    "cta",
    "image",
] as const

type EmailBlock = Extract<
    OwidEnrichedGdocBlock,
    { type: (typeof EMAIL_BLOCK_TYPES)[number] }
>

function isEmailBlock(block: OwidEnrichedGdocBlock): block is EmailBlock {
    return (EMAIL_BLOCK_TYPES as readonly string[]).includes(block.type)
}

/**
 * Render the subset of ArchieML blocks that data insight and announcement
 * bodies use by convention (image + text, occasionally a heading or list).
 * Other block types are skipped.
 */
function Block({
    block,
    imageUrlsByFilename,
    imageHref,
}: {
    block: OwidEnrichedGdocBlock
    imageUrlsByFilename: Record<string, string>
    /** When set, image blocks link here. */
    imageHref?: string
}): ReactNode {
    if (!isEmailBlock(block)) return null
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
                        <u>{block.text}</u> →
                    </Link>
                </Text>
            )
        case "image": {
            const filename = block.preferSmallFilename
                ? (block.smallFilename ?? block.filename)
                : block.filename
            const url = imageUrlsByFilename[filename]
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
    updatePreferencesUrl,
}: {
    email: string
    baseUrl: string
    updatePreferencesUrl: string
}) {
    return (
        <EmailFooter>
            <Text
                style={{
                    ...BODY_TEXT,
                    margin: "0 0 40px",
                    textAlign: "center",
                }}
            >
                <EmailButton href={`${baseUrl}/latest`}>
                    Keep browsing
                </EmailButton>
            </Text>
            <Section
                style={{
                    backgroundColor: COLORS.cardMuted,
                    padding: `16px`,
                }}
            >
                <Text>
                    The{" "}
                    <Link
                        href={`${baseUrl}/about#our-mission`}
                        style={{ ...FOOTER_LINK_STYLE, color: COLORS.text }}
                    >
                        mission of Our World in Data
                    </Link>{" "}
                    is to make data and research on the world's largest problems
                    understandable and accessible.
                </Text>
                <Text>
                    We are a nonprofit, building Our World in Data as a public
                    good that's freely available to everyone. Help us do more by
                    supporting us with a donation.
                </Text>
                <Link
                    href={`${baseUrl}/donate`}
                    style={{
                        display: "inline-block",
                        padding: "12px 24px",
                        backgroundColor: COLORS.vermillion,
                        color: "#ffffff",
                        fontWeight: 700,
                        textDecoration: "none",
                        marginBottom: "12px",
                    }}
                >
                    Donate now
                </Link>
            </Section>
            <Spacer height={24} />
            <Text style={FOOTER_TEXT_STYLE}>
                This email was sent to {email} because you subscribed to email
                updates from Our World in Data.
            </Text>
            <Text style={FOOTER_TEXT_STYLE}>
                You can{" "}
                <Link href={updatePreferencesUrl} style={FOOTER_LINK_STYLE}>
                    update your preferences
                </Link>{" "}
                at any time.
            </Text>
        </EmailFooter>
    )
}
