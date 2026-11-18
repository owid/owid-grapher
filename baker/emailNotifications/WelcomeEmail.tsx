import { CSSProperties, ReactNode } from "react"
import { Heading, Link, Section, Text } from "@react-email/components"
import {
    BODY_FONT,
    BODY_LINK_STYLE,
    BODY_TEXT,
    COLORS,
    EmailContent,
    EmailFooter,
    EmailLayout,
    EmailTitle,
    FOOTER_TEXT_STYLE,
} from "./EmailLayout.js"

export const WELCOME_EMAIL_SUBJECT = "Welcome to Our World in Data"
export const SUBSCRIPTION_UPDATED_EMAIL_SUBJECT =
    "You're subscribed to Our World in Data updates"

const PARAGRAPH: CSSProperties = { ...BODY_TEXT, margin: "0 0 16px" }
const PREFERENCE_TEXT: CSSProperties = { ...BODY_TEXT, margin: "4px 0" }

const KEY_IDEAS = [
    {
        slug: "problems-and-progress",
        title: "Why do we need to know about progress if we are concerned about the world's largest problems?",
    },
    {
        slug: "much-better-awful-can-be-better",
        title: "The world is awful. The world is much better. The world can be much better.",
    },
    {
        slug: "limits-personal-experience",
        title: "The limits of our personal experience and the value of statistics",
    },
    {
        slug: "a-history-of-global-living-conditions",
        title: "The short history of global living conditions and why it matters that we know it",
    },
]

export interface WelcomeEmailProps {
    email: string
    topics: string
    contentTypes: string
    frequency: string
    siteBaseUrl: string
    updatePreferencesUrl: string
    unsubscribeUrl: string
}

/**
 * Sent when an address that already got the full welcome email submits the
 * subscribe form with notifications again, so this only confirms the (merged)
 * preferences.
 */
export function SubscriptionUpdatedEmail({
    email,
    topics,
    contentTypes,
    frequency,
    siteBaseUrl,
    updatePreferencesUrl,
    unsubscribeUrl,
}: WelcomeEmailProps): ReactNode {
    return (
        <EmailLayout
            title={SUBSCRIPTION_UPDATED_EMAIL_SUBJECT}
            preview="You'll receive an email when we publish new work matching your preferences."
            baseUrl={siteBaseUrl}
            header="generic"
        >
            <EmailContent>
                <EmailTitle>You're subscribed</EmailTitle>
                <Text style={PARAGRAPH}>
                    You'll receive an email when we publish new work matching
                    your preferences.
                </Text>
                <Text style={PARAGRAPH}>Your notification preferences:</Text>
                <PreferencesCard
                    topics={topics}
                    contentTypes={contentTypes}
                    frequency={frequency}
                />
                <ManagePreferencesText
                    marginTop={24}
                    updatePreferencesUrl={updatePreferencesUrl}
                    unsubscribeUrl={unsubscribeUrl}
                />
            </EmailContent>
            <WelcomeEmailFooter email={email} />
        </EmailLayout>
    )
}

/**
 * What the subscriber signed up for, which decides the "What to expect"
 * section. Brief-only signups have no notification preferences to show.
 */
export type WelcomeEmailVariant =
    | "notifications"
    | "notificationsAndBrief"
    | "brief"

/**
 * Sent once per address, on its first notifications or Brief signup through
 * the subscribe form.
 */
export function WelcomeEmail({
    variant,
    email,
    topics,
    contentTypes,
    frequency,
    siteBaseUrl,
    updatePreferencesUrl,
    unsubscribeUrl,
}: WelcomeEmailProps & { variant: WelcomeEmailVariant }): ReactNode {
    const siteLink = (path: string, children: ReactNode): ReactNode => (
        <Link href={`${siteBaseUrl}${path}`} style={BODY_LINK_STYLE}>
            {children}
        </Link>
    )
    return (
        <EmailLayout
            title={WELCOME_EMAIL_SUBJECT}
            preview="You're set to receive data-driven insights and explanations of the key trends shaping our world."
            baseUrl={siteBaseUrl}
            header="generic"
        >
            <EmailContent>
                <EmailTitle>Welcome to our newsletter!</EmailTitle>
                <Text style={PARAGRAPH}>
                    Hi, I'm {siteLink("/team/max-roser", "Max Roser")}, the
                    founder and co-director of Our World in Data.
                </Text>
                <Text style={PARAGRAPH}>
                    As part of our newsletter community, you're set to receive
                    data-driven insights and explanations of the key trends
                    shaping our world, right to your inbox.
                </Text>
                <Text style={{ ...PARAGRAPH, margin: 0 }}>
                    This is a great way to learn more about the world and how
                    it's changing, keep up to date with our latest work, and
                    find entry points into our rich catalog of data and
                    research. I hope you enjoy it!
                </Text>

                <SectionHeading>What to expect in your inbox</SectionHeading>
                {variant !== "notifications" && (
                    <Text style={PARAGRAPH}>
                        <b>The OWID Brief:</b> Stay up to date with our latest
                        work plus curated highlights from across Our World in
                        Data, twice a month.
                    </Text>
                )}
                {variant === "notifications" && (
                    <Text style={PARAGRAPH}>
                        You'll receive an email when we publish new work
                        matching your preferences:
                    </Text>
                )}
                {variant === "notificationsAndBrief" && (
                    <Text style={PARAGRAPH}>
                        <b>Topic notifications:</b> You'll receive an email when
                        we publish new work matching your preferences:
                    </Text>
                )}
                {variant === "brief" ? (
                    <Text style={{ ...BODY_TEXT, margin: 0 }}>
                        You can{" "}
                        <Link
                            href={updatePreferencesUrl}
                            style={BODY_LINK_STYLE}
                        >
                            update your preferences
                        </Link>{" "}
                        at any time.
                    </Text>
                ) : (
                    <>
                        <PreferencesCard
                            topics={topics}
                            contentTypes={contentTypes}
                            frequency={frequency}
                        />
                        <ManagePreferencesText
                            marginTop={16}
                            updatePreferencesUrl={updatePreferencesUrl}
                            unsubscribeUrl={unsubscribeUrl}
                        />
                    </>
                )}

                <SectionHeading>Who we are</SectionHeading>
                <Text style={PARAGRAPH}>
                    {siteLink("/", "Our World in Data")} (OWID) is a free,
                    open-access website that makes data and research on the
                    biggest global challenges easier to access and understand,
                    to empower those working to build a better world.
                </Text>
                <Text style={{ ...PARAGRAPH, margin: 0 }}>
                    OWID is a collaborative effort between{" "}
                    <Link
                        href="https://www.oxfordmartin.ox.ac.uk/global-development"
                        style={BODY_LINK_STYLE}
                    >
                        researchers at the University of Oxford
                    </Link>{" "}
                    and the{" "}
                    <Link
                        href="https://global-change-data-lab.org/"
                        style={BODY_LINK_STYLE}
                    >
                        UK-based charity Global Change Data Lab
                    </Link>
                    . Learn more about{" "}
                    {siteLink("/about", "our mission, funding, team, and more")}
                    .
                </Text>

                <SectionHeading>
                    Global data and research on 120+ topics
                </SectionHeading>
                <Text style={PARAGRAPH}>
                    We bring together high-quality data on more than{" "}
                    {siteLink("/#all-topics", "120 topics")}, such as poverty,
                    CO₂ emissions and climate change, migration, democracy,
                    global health, population growth, armed conflicts, and
                    artificial intelligence.
                </Text>
                <Text style={PARAGRAPH}>
                    Our researchers and data scientists help you understand
                    these topics, writing explanations that describe the data,
                    what it shows, and why it matters.
                </Text>
                <Text style={PARAGRAPH}>
                    We make it easy to explore this data in over{" "}
                    {siteLink("/search", "14,000 interactive charts and maps")}{" "}
                    and {siteLink("/explorers", "30+ data explorers")} — all{" "}
                    {siteLink(
                        "/faqs#can-i-reuse-or-republish-your-charts",
                        "free to reuse"
                    )}{" "}
                    under our permissive Creative Commons license. You can also{" "}
                    {siteLink(
                        "/new-feature-embed-archived-charts",
                        "embed interactive versions of our charts"
                    )}{" "}
                    on any website.
                </Text>
                <Text style={{ ...PARAGRAPH, margin: 0 }}>
                    We've also made it easy to{" "}
                    {siteLink(
                        "/easier-to-reuse-our-data",
                        "download and reuse the data"
                    )}{" "}
                    in our charts.
                </Text>

                <SectionHeading>
                    Read more about our mission and key ideas
                </SectionHeading>
                {KEY_IDEAS.map(({ slug, title }, index) => (
                    <Text
                        key={slug}
                        style={
                            index === KEY_IDEAS.length - 1
                                ? { ...PARAGRAPH, margin: 0 }
                                : PARAGRAPH
                        }
                    >
                        {siteLink(`/${slug}`, title)}
                    </Text>
                ))}

                <SectionHeading>Thanks for subscribing!</SectionHeading>
                <Text style={PARAGRAPH}>
                    I truly hope you enjoy our newsletter. If you do, please
                    consider sharing it with others who you think would find it
                    useful — they can {siteLink("/subscribe", "subscribe here")}
                    . If you have any questions or feedback, just reply to this
                    email.
                </Text>
                <Text style={{ ...BODY_TEXT, margin: 0 }}>
                    Wishing you all the best,
                    <br />
                    Max
                </Text>
            </EmailContent>
            <WelcomeEmailFooter email={email} />
        </EmailLayout>
    )
}

function PreferencesCard({
    topics,
    contentTypes,
    frequency,
}: Pick<
    WelcomeEmailProps,
    "topics" | "contentTypes" | "frequency"
>): ReactNode {
    return (
        <Section
            className="card"
            style={{ backgroundColor: COLORS.cardMuted, padding: "16px 24px" }}
        >
            <Text style={PREFERENCE_TEXT}>
                <b>Topics:</b> {topics}
            </Text>
            <Text style={PREFERENCE_TEXT}>
                <b>Content types:</b> {contentTypes}
            </Text>
            <Text style={PREFERENCE_TEXT}>
                <b>Frequency:</b> {frequency}
            </Text>
        </Section>
    )
}

function ManagePreferencesText({
    marginTop,
    updatePreferencesUrl,
    unsubscribeUrl,
}: Pick<WelcomeEmailProps, "updatePreferencesUrl" | "unsubscribeUrl"> & {
    marginTop: number
}): ReactNode {
    return (
        <Text style={{ ...BODY_TEXT, margin: `${marginTop}px 0 0` }}>
            You can{" "}
            <Link href={updatePreferencesUrl} style={BODY_LINK_STYLE}>
                update your preferences
            </Link>{" "}
            or{" "}
            <Link href={unsubscribeUrl} style={BODY_LINK_STYLE}>
                unsubscribe from topic notifications
            </Link>{" "}
            at any time.
        </Text>
    )
}

function WelcomeEmailFooter({ email }: { email: string }): ReactNode {
    return (
        <EmailFooter>
            <Text style={FOOTER_TEXT_STYLE}>
                This email was sent to {email} because you subscribed to email
                updates from Our World in Data.
            </Text>
        </EmailFooter>
    )
}

function SectionHeading({ children }: { children: ReactNode }): ReactNode {
    return (
        <Heading
            as="h2"
            style={{
                margin: "32px 0 12px",
                fontFamily: BODY_FONT,
                fontSize: 20,
                lineHeight: "28px",
                fontWeight: 700,
                color: COLORS.text,
            }}
        >
            {children}
        </Heading>
    )
}
