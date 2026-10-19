import { ReactElement } from "react"
import { render } from "@react-email/components"

export interface RenderedEmail {
    subject: string
    html: string
    /** Text alternative for clients that don't render HTML. */
    text: string
}

export async function renderEmail(
    subject: string,
    email: ReactElement
): Promise<RenderedEmail> {
    const [html, text] = await Promise.all([
        render(email),
        render(email, { plainText: true }),
    ])
    return { subject, html, text }
}
