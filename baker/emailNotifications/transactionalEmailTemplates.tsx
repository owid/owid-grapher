import path from "path"
import { fileURLToPath } from "url"
import { RenderedEmail, renderEmail } from "./renderEmail.js"
import { WELCOME_EMAIL_SUBJECT, WelcomeEmail } from "./WelcomeEmail.js"
import { MAGIC_LINK_EMAIL_SUBJECT, MagicLinkEmail } from "./MagicLinkEmail.js"

/**
 * The transactional emails are sent by the Cloudflare functions, which can't
 * afford React Email in their bundle. They are rendered here once, with
 * `{{placeholder}}` values the function substitutes per recipient, and the
 * result is committed as JSON next to the sender. `yarn
 * buildTransactionalEmailTemplates` regenerates the files; a test fails when
 * they are stale.
 */
export const TRANSACTIONAL_EMAIL_TEMPLATES_DIR = fileURLToPath(
    new URL("../../functions/_common/emailTemplates/", import.meta.url)
)

const TEMPLATES: Record<string, () => Promise<RenderedEmail>> = {
    welcome: () =>
        renderEmail(
            WELCOME_EMAIL_SUBJECT,
            <WelcomeEmail
                email="{{email}}"
                topics="{{topics}}"
                contentTypes="{{contentTypes}}"
                frequency="{{frequency}}"
                siteBaseUrl="{{siteBaseUrl}}"
                updatePreferencesUrl="{{updatePreferencesUrl}}"
                unsubscribeUrl="{{unsubscribeUrl}}"
            />
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
