import * as _ from "lodash-es"
import welcome from "./emailTemplates/welcome.json"
import magicLink from "./emailTemplates/magicLink.json"

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
