import { useRef, useState } from "react"
import { TurnstileInstance } from "@marsidev/react-turnstile"

export const NEWSLETTER_HONEYPOT_FIELD = "website"

export function useNewsletterSpamProtection() {
    const ref = useRef<TurnstileInstance>(undefined)
    const [captchaToken, setCaptchaToken] = useState("")

    return {
        ref,
        captchaToken,
        setCaptchaToken,
        resetCaptcha: () => {
            setCaptchaToken("")
            ref.current?.reset()
        },
        /** The spam-protection fields of an API request, read from the submitted form. */
        spamProtectionFields: (form: HTMLFormElement) => ({
            captchaToken,
            website:
                new FormData(form).get(NEWSLETTER_HONEYPOT_FIELD)?.toString() ??
                "",
        }),
    }
}
