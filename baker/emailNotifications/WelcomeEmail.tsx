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
    topics: string
    contentTypes: string
    frequency: string
    siteBaseUrl: string
    updatePreferencesUrl: string
    unsubscribeUrl: string
}

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
                    You'll receive an email when we publish new work matching
                    your preferences.
                </Text>
                <Text style={{ ...BODY_TEXT, margin: "0 0 16px" }}>
                    Your notification preferences:
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
                        unsubscribe from topic notifications
                    </Link>{" "}
                    at any time.
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
