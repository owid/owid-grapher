import { ReactNode } from "react"
import { Link, Text } from "@react-email/components"
import {
    BODY_LINK_STYLE,
    BODY_TEXT,
    COLORS,
    EmailButton,
    EmailContent,
    EmailFooter,
    EmailLayout,
    EmailTitle,
    FOOTER_TEXT_STYLE,
} from "./EmailLayout.js"

export const MAGIC_LINK_EMAIL_SUBJECT =
    "Update your Our World in Data notification preferences"

export interface MagicLinkEmailProps {
    email: string
    /** Public site origin, for the header image and link. */
    siteBaseUrl: string
    magicLinkUrl: string
}

export function MagicLinkEmail({
    email,
    siteBaseUrl,
    magicLinkUrl,
}: MagicLinkEmailProps): ReactNode {
    return (
        <EmailLayout
            title={MAGIC_LINK_EMAIL_SUBJECT}
            preview="Your link to update your preferences is valid for 30 minutes."
            baseUrl={siteBaseUrl}
        >
            <EmailContent>
                <EmailTitle>Update your preferences</EmailTitle>
                <Text style={{ ...BODY_TEXT, margin: "0 0 24px" }}>
                    Click the button below to view and update your Our World in
                    Data email notification preferences. The link is valid for
                    30 minutes.
                </Text>
                <Text style={{ ...BODY_TEXT, margin: "0 0 24px" }}>
                    <EmailButton href={magicLinkUrl}>
                        Update my preferences
                    </EmailButton>
                </Text>
                <Text
                    style={{
                        margin: "0 0 16px",
                        fontSize: 13,
                        lineHeight: "20px",
                        color: COLORS.muted,
                    }}
                >
                    If the button doesn't work, copy and paste this link into
                    your browser:{" "}
                    <Link href={magicLinkUrl} style={BODY_LINK_STYLE}>
                        {magicLinkUrl}
                    </Link>
                </Text>
                <Text style={{ ...BODY_TEXT, margin: 0 }}>
                    If you didn't request this, you can safely ignore this email
                    — nothing will change.
                </Text>
            </EmailContent>
            <EmailFooter>
                <Text style={FOOTER_TEXT_STYLE}>
                    This email was sent to {email} because someone requested a
                    link to update the notification preferences for this
                    address.
                </Text>
            </EmailFooter>
        </EmailLayout>
    )
}
