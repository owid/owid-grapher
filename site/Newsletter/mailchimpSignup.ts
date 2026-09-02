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

function appendHiddenInput(
    form: HTMLFormElement,
    name: string,
    value: string
): void {
    const input = document.createElement("input")
    input.type = "hidden"
    input.name = name
    input.value = value
    form.append(input)
}

/**
 * Continue an OWID Brief opt-in through Mailchimp's browser-hosted form
 * endpoint. Unlike the Marketing API, this flow can resubscribe a contact who
 * previously opted out and lets Mailchimp record the renewed consent.
 */
export function submitOwidBriefSignupToMailchimp(email: string): void {
    const form = document.createElement("form")
    form.action = MAILCHIMP_NEWSLETTER_SIGNUP_FORM_ACTION
    form.method = "post"
    form.hidden = true
    form.className = "sentry-mask"

    appendHiddenInput(form, "EMAIL", email)
    appendHiddenInput(
        form,
        makeMailchimpNewsletterGroupInputName(MAILCHIMP_OWID_BRIEF_GROUP_VALUE),
        MAILCHIMP_OWID_BRIEF_GROUP_VALUE
    )
    appendHiddenInput(form, MAILCHIMP_SIGNUP_HONEYPOT_NAME, "")

    document.body.append(form)
    form.submit()
}
