import { ReactNode } from "react"
import { Link, Section, Text } from "@react-email/components"
import {
    BODY_LINK_STYLE,
    BODY_TEXT,
    COLORS,
    EmailContent,
    EmailFooter,
    EmailLayout,
    EmailTitle,
    FOOTER_TEXT_STYLE,
} from "./EmailLayout.js"

export const WELCOME_EMAIL_SUBJECT =
    "You're subscribed to Our World in Data updates"

const PREFERENCE_TEXT = { ...BODY_TEXT, margin: "4px 0" }

export interface WelcomeEmailProps {
    email: string
    /** Display strings; the sender formats the preferences. */
    topics: string
    contentTypes: string
    frequency: string
    /** Public site origin, for the header image and link. */
    siteBaseUrl: string
    updatePreferencesUrl: string
    unsubscribeUrl: string
}

/**
 * Welcome email sent on every subscribe-form submission. Carries the
 * permanent per-user token's links for updating or unsubscribing from these
 * notifications — for an address submitted by someone else, this email is also
 * what lets the owner notice and undo the change.
 */
export function WelcomeEmail({
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
            title={WELCOME_EMAIL_SUBJECT}
            preview="You'll receive an email when we publish new work matching your preferences."
            baseUrl={siteBaseUrl}
            header="generic"
        >
            <EmailContent>
                <EmailTitle>You're subscribed</EmailTitle>
                <Text style={{ ...BODY_TEXT, margin: "0 0 16px" }}>
                    Thanks for subscribing to email updates from Our World in
                    Data! You're all set — you'll receive an email when we
                    publish new work matching your preferences.
                </Text>
                <Text style={{ ...BODY_TEXT, margin: "0 0 16px" }}>
                    These are your notification preferences:
                </Text>
                <Section
                    className="card"
                    style={{
                        backgroundColor: COLORS.cardMuted,
                        padding: "16px 24px",
                    }}
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
                <Text style={{ ...BODY_TEXT, margin: "24px 0 0" }}>
                    You can{" "}
                    <Link href={updatePreferencesUrl} style={BODY_LINK_STYLE}>
                        update your preferences
                    </Link>{" "}
                    or{" "}
                    <Link href={unsubscribeUrl} style={BODY_LINK_STYLE}>
                        unsubscribe from Follow Topics
                    </Link>{" "}
                    at any time — these links are also in the footer of every
                    Follow Topics email we send.
                </Text>
            </EmailContent>
            <EmailFooter>
                <Text style={FOOTER_TEXT_STYLE}>
                    This email was sent to {email} because you subscribed to
                    email updates from Our World in Data.
                </Text>
            </EmailFooter>
        </EmailLayout>
    )
}
