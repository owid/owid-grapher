import path from "path"
import { fileURLToPath } from "url"
import { RenderedEmail, renderEmail } from "./renderEmail.js"
import {
    SUBSCRIPTION_UPDATED_EMAIL_SUBJECT,
    SubscriptionUpdatedEmail,
    WELCOME_EMAIL_SUBJECT,
    WelcomeEmail,
    WelcomeEmailProps,
} from "./WelcomeEmail.js"
import { MAGIC_LINK_EMAIL_SUBJECT, MagicLinkEmail } from "./MagicLinkEmail.js"

// Pre-rendered because the Cloudflare functions can't afford React Email in
// their bundle; see functions/_common/emailTemplates/README.md.
export const TRANSACTIONAL_EMAIL_TEMPLATES_DIR = fileURLToPath(
    new URL("../../functions/_common/emailTemplates/", import.meta.url)
)

const WELCOME_EMAIL_PLACEHOLDERS: WelcomeEmailProps = {
    email: "{{email}}",
    topics: "{{topics}}",
    contentTypes: "{{contentTypes}}",
    frequency: "{{frequency}}",
    siteBaseUrl: "{{siteBaseUrl}}",
    updatePreferencesUrl: "{{updatePreferencesUrl}}",
    unsubscribeUrl: "{{unsubscribeUrl}}",
}

const TEMPLATES: Record<string, () => Promise<RenderedEmail>> = {
    welcome: () =>
        renderEmail(
            WELCOME_EMAIL_SUBJECT,
            <WelcomeEmail
                variant="notifications"
                {...WELCOME_EMAIL_PLACEHOLDERS}
            />
        ),
    welcomeWithBrief: () =>
        renderEmail(
            WELCOME_EMAIL_SUBJECT,
            <WelcomeEmail
                variant="notificationsAndBrief"
                {...WELCOME_EMAIL_PLACEHOLDERS}
            />
        ),
    welcomeBriefOnly: () =>
        renderEmail(
            WELCOME_EMAIL_SUBJECT,
            <WelcomeEmail variant="brief" {...WELCOME_EMAIL_PLACEHOLDERS} />
        ),
    subscriptionUpdated: () =>
        renderEmail(
            SUBSCRIPTION_UPDATED_EMAIL_SUBJECT,
            <SubscriptionUpdatedEmail {...WELCOME_EMAIL_PLACEHOLDERS} />
        ),
    magicLink: () =>
        renderEmail(
            MAGIC_LINK_EMAIL_SUBJECT,
            <MagicLinkEmail
                email="{{email}}"
                siteBaseUrl="{{siteBaseUrl}}"
                magicLinkUrl="{{magicLinkUrl}}"
            />
        ),
}

export function transactionalEmailTemplatePath(name: string): string {
    return path.join(TRANSACTIONAL_EMAIL_TEMPLATES_DIR, `${name}.json`)
}

export async function renderTransactionalEmailTemplates(): Promise<
    Record<string, RenderedEmail>
> {
    const entries = await Promise.all(
        Object.entries(TEMPLATES).map(
            async ([name, render]) => [name, await render()] as const
        )
    )
    return Object.fromEntries(entries)
}
