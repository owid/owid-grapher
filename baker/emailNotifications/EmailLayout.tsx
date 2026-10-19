import { CSSProperties, ReactNode } from "react"
import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Text,
} from "@react-email/components"

export const COLORS = {
    background: "#f7f7f7",
    card: "#ffffff",
    cardMuted: "#ebeef2",
    navy: "#002147",
    text: "#1d3d63",
    muted: "#426591",
    headerText: "#a4b6ca",
    vermillion: "#ce261e",
}

export const BODY_FONT = "Arial, Helvetica, sans-serif"
export const SERIF_FONT = '"Times New Roman", serif'

export const CONTAINER_WIDTH = 632
export const CONTENT_PADDING = 40
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

// Outlook on Windows ignores max-width, so the fluid container would stretch
// to the reading pane. These wrap it in a fixed-width "ghost" table that only
// Outlook sees. React can't emit comments, hence the raw HTML.
const MSO_GHOST_TABLE_OPEN = `<!--[if mso]><table role="presentation" align="center" width="${CONTAINER_WIDTH}" border="0" cellpadding="0" cellspacing="0"><tr><td><![endif]-->`
const MSO_GHOST_TABLE_CLOSE = `<!--[if mso]></td></tr></table><![endif]-->`

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
export const BODY_TEXT: CSSProperties = { fontSize: 16, lineHeight: "24px" }

// react-email's <Link> defaults to a blue that a client shows on the alt text
// when it blocks the image, so links wrapping an image override it.
export const IMAGE_LINK_STYLE: CSSProperties = {
    color: COLORS.text,
    textDecoration: "none",
}

export const FOOTER_TEXT_STYLE: CSSProperties = {
    margin: "0 0 8px",
    fontSize: 13,
    lineHeight: "20px",
    color: COLORS.muted,
    textAlign: "center",
}

export const FOOTER_LINK_STYLE: CSSProperties = {
    color: COLORS.muted,
    textDecoration: "underline",
}

/**
 * The frame every email shares: document, inbox preview text, the branded
 * header and the Outlook width fixes. Children render inside the container
 * below the header; wrap them in EmailContent and EmailFooter.
 */
export function EmailLayout({
    title,
    preview,
    baseUrl,
    children,
}: {
    title: string
    /** Inbox preview text: shown next to the subject in most clients. */
    preview: string
    /** Public site origin, for the header image and link. */
    baseUrl: string
    children: ReactNode
}): ReactNode {
    return (
        <Html lang="en">
            <Head>
                <title>{title}</title>
                <style>{RESPONSIVE_STYLES}</style>
            </Head>
            <Preview>{preview}</Preview>
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
                <div
                    dangerouslySetInnerHTML={{ __html: MSO_GHOST_TABLE_OPEN }}
                />
                <Container
                    style={{
                        width: "100%",
                        maxWidth: CONTAINER_WIDTH,
                        margin: "0 auto",
                        backgroundColor: COLORS.background,
                    }}
                >
                    <Header baseUrl={baseUrl} />
                    {children}
                </Container>
                <div
                    dangerouslySetInnerHTML={{ __html: MSO_GHOST_TABLE_CLOSE }}
                />
            </Body>
        </Html>
    )
}

/**
 * Vertical space between blocks. A spacer row rather than a margin, because
 * Outlook ignores margins on tables; the 1px font size stops the &nbsp; from
 * making the row taller than asked for.
 */
export function Spacer({ height }: { height: number }): ReactNode {
    return (
        <Section style={{ height, lineHeight: `${height}px`, fontSize: 1 }}>
            &nbsp;
        </Section>
    )
}

function Header({ baseUrl }: { baseUrl: string }): ReactNode {
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

/** The padded main column between the header and the footer. */
export function EmailContent({ children }: { children: ReactNode }): ReactNode {
    return (
        <Section
            className="content"
            style={{ padding: `32px ${CONTENT_PADDING}px 40px` }}
        >
            {children}
        </Section>
    )
}

/**
 * Centered footer column ending in the sender's postal address. Children are
 * the email-specific parts: the "sent to … because …" line and, for digests,
 * the calls to action above it.
 */
export function EmailFooter({ children }: { children: ReactNode }): ReactNode {
    return (
        <Section
            className="content"
            style={{
                padding: `0 ${CONTENT_PADDING}px 40px`,
                textAlign: "center",
            }}
        >
            {children}
            <Text style={{ ...FOOTER_TEXT_STYLE, marginBottom: 0 }}>
                Our World in Data · Global Change Data Lab · Oxford, United
                Kingdom
            </Text>
        </Section>
    )
}

export const BODY_LINK_STYLE: CSSProperties = {
    color: COLORS.text,
    textDecoration: "underline",
}

/** The one heading of a transactional email. */
export function EmailTitle({ children }: { children: ReactNode }): ReactNode {
    return (
        <Heading
            as="h1"
            style={{
                margin: "0 0 16px",
                fontFamily: BODY_FONT,
                fontSize: 24,
                lineHeight: "32px",
                fontWeight: 700,
                color: COLORS.text,
            }}
        >
            {children}
        </Heading>
    )
}

export function EmailButton({
    href,
    children,
}: {
    href: string
    children: ReactNode
}): ReactNode {
    return (
        <Button
            href={href}
            style={{
                padding: "12px 24px",
                backgroundColor: COLORS.navy,
                color: "#ffffff",
                fontWeight: 700,
            }}
        >
            {children}
        </Button>
    )
}
