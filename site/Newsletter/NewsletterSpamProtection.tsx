import { Ref, useState } from "react"
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile"
import { TURNSTILE_SITE_KEY } from "../../settings/clientSettings.mjs"
import { NEWSLETTER_HONEYPOT_FIELD } from "./useNewsletterSpamProtection.js"

export function NewsletterSpamProtection({
    action = "subscribe",
    ref,
    onToken,
}: {
    action?: "subscribe" | "request-link"
    ref: Ref<TurnstileInstance | undefined>
    /** Called with the verification token, or "" when it is no longer valid. */
    onToken: (token: string) => void
}) {
    const [error, setError] = useState<string | null>(null)

    function onError() {
        onToken("")
        setError(
            "Verification could not load. Please reload the page and try again."
        )
    }

    return (
        <>
            {/* A trap for form-filling bots: humans never see it, so a filled
            value marks the submission as spam. Keep anything that would give
            that away out of the rendered markup. */}
            <div className="newsletter-form__website" aria-hidden="true">
                <label>
                    Website
                    <input
                        type="text"
                        name={NEWSLETTER_HONEYPOT_FIELD}
                        tabIndex={-1}
                        autoComplete="off"
                    />
                </label>
            </div>
            <Turnstile
                ref={ref}
                className="newsletter-form__turnstile"
                siteKey={TURNSTILE_SITE_KEY}
                options={{
                    action,
                    appearance: "interaction-only",
                    size: "flexible",
                }}
                onSuccess={(token) => {
                    onToken(token)
                    setError(null)
                }}
                onExpire={() => onToken("")}
                onTimeout={() => onToken("")}
                onError={onError}
                onUnsupported={onError}
                scriptOptions={{ onError }}
            />
            {error && (
                <p className="newsletter-form__alert" role="alert">
                    {error}
                </p>
            )}
        </>
    )
}
