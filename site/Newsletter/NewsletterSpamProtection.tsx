import { Turnstile } from "@marsidev/react-turnstile"
import { TURNSTILE_SITE_KEY } from "../../settings/clientSettings.mjs"
import { useNewsletterSpamProtection } from "./useNewsletterSpamProtection.js"

export function NewsletterSpamProtection({
    action = "subscribe",
    ref,
    error,
    setError,
    setCaptchaToken,
}: ReturnType<typeof useNewsletterSpamProtection>["fieldsProps"] & {
    action?: "subscribe" | "request-link"
}) {
    function onError() {
        setCaptchaToken("")
        setError(
            "Verification could not load. Please reload the page and try again."
        )
    }

    return (
        <>
            <div className="newsletter-form__honeypot" aria-hidden="true">
                <label>
                    Leave this field empty
                    <input
                        type="text"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                    />
                </label>
            </div>
            <Turnstile
                ref={ref}
                siteKey={TURNSTILE_SITE_KEY}
                options={{
                    action,
                    appearance: "interaction-only",
                    size: "flexible",
                }}
                onSuccess={(token) => {
                    setCaptchaToken(token)
                    setError(null)
                }}
                onExpire={() => setCaptchaToken("")}
                onTimeout={() => setCaptchaToken("")}
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
