export const NewslettersTableName = "newsletters"

/** The Mailchimp campaign types we sync from the Mailchimp Marketing API,
 * distinguished by the audience interest group they were sent to (see
 * baker/syncNewslettersFromMailchimp.ts). Only "owid-brief" newsletters are
 * shown on /latest; both types feed the "see example" links on /subscribe. */
export const NEWSLETTER_TYPES = ["owid-brief", "data-insight"] as const
export type NewsletterType = (typeof NEWSLETTER_TYPES)[number]

export type DbInsertNewsletter = {
    /** Mailchimp campaign id as returned by the Marketing API */
    mailchimpId: string
    type: NewsletterType
    title: string
    /** Public Mailchimp campaign-archive URL the /latest tile links out to */
    url: string
    publishedAt: Date
    createdAt?: Date
    updatedAt?: Date
}

export type DbPlainNewsletter = Required<DbInsertNewsletter> & {
    id: number
}
