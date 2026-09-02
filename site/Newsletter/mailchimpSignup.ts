export const MAILCHIMP_NEWSLETTER_SIGNUP_FORM_ACTION =
    "https://ourworldindata.us8.list-manage.com/subscribe/post?u=18058af086319ba6afad752ec&id=2e166c1fc1"

export const MAILCHIMP_NEWSLETTER_GROUP_ID = "85302"
export const MAILCHIMP_OWID_BRIEF_GROUP_VALUE = "2"
export const MAILCHIMP_SIGNUP_HONEYPOT_NAME =
    "b_18058af086319ba6afad752ec_2e166c1fc1"

export function makeMailchimpNewsletterGroupInputName(
    groupValue: string
): string {
    return `group[${MAILCHIMP_NEWSLETTER_GROUP_ID}][${groupValue}]`
}
