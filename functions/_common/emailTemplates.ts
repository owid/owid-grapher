import * as _ from "lodash-es"
import welcome from "./emailTemplates/welcome.json"
import magicLink from "./emailTemplates/magicLink.json"

/**
 * A transactional email pre-rendered by the baker (see
 * baker/emailNotifications/transactionalEmailTemplates.tsx) with
 * `{{placeholder}}` values to fill in per recipient.
 */
export interface EmailTemplate {
    subject: string
    html: string
    text: string
}

export const EMAIL_TEMPLATES = { welcome, magicLink } satisfies Record<
    string,
    EmailTemplate
>

const PLACEHOLDER = /{{(\w+)}}/g

/**
 * Fill a template's placeholders. Values are HTML-escaped in the HTML body
 * (they include user-submitted topic names) and inserted verbatim in the
 * subject and text body. Throws when the template needs a value that wasn't given, so a
 * placeholder renamed on one side can't reach a reader.
 */
export function renderEmailTemplate(
    template: EmailTemplate,
    values: Record<string, string>
): EmailTemplate {
    const fill = (body: string, escape: (value: string) => string): string =>
        body.replace(PLACEHOLDER, (_match, key: string) => {
            const value = values[key]
            if (value === undefined) {
                throw new Error(`Email template has no value for {{${key}}}`)
            }
            return escape(value)
        })
    return {
        subject: fill(template.subject, (value) => value),
        html: fill(template.html, _.escape),
        text: fill(template.text, (value) => value),
    }
}
