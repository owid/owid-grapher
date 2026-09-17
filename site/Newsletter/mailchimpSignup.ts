import {
    MAILCHIMP_API_SERVER,
    MAILCHIMP_NEWSLETTER_LIST_ID,
} from "@ourworldindata/types"

export const MAILCHIMP_NEWSLETTER_SIGNUP_FORM_ACTION = `https://ourworldindata.${MAILCHIMP_API_SERVER}.list-manage.com/subscribe/post?u=18058af086319ba6afad752ec&id=${MAILCHIMP_NEWSLETTER_LIST_ID}`

export const MAILCHIMP_NEWSLETTER_GROUP_ID = "85302"
export const MAILCHIMP_OWID_BRIEF_GROUP_VALUE = "2"
export const MAILCHIMP_SIGNUP_HONEYPOT_NAME = `b_18058af086319ba6afad752ec_${MAILCHIMP_NEWSLETTER_LIST_ID}`

export function makeMailchimpNewsletterGroupInputName(
    groupValue: string
): string {
    return `group[${MAILCHIMP_NEWSLETTER_GROUP_ID}][${groupValue}]`
}
