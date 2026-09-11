import { useRef, useState } from "react"
import { TurnstileInstance } from "@marsidev/react-turnstile"

export function useNewsletterSpamProtection() {
    const ref = useRef<TurnstileInstance>(undefined)
    const [captchaToken, setCaptchaToken] = useState("")
    const [error, setError] = useState<string | null>(null)

    function resetCaptcha() {
        setCaptchaToken("")
        ref.current?.reset()
    }

    return {
        captchaToken,
        resetCaptcha,
        fieldsProps: { ref, error, setError, setCaptchaToken },
    }
}
