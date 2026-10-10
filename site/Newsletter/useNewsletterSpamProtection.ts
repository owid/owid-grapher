import { useRef, useState } from "react"
import { TurnstileInstance } from "@marsidev/react-turnstile"

export function useNewsletterSpamProtection() {
    const ref = useRef<TurnstileInstance>(undefined)
    const [captchaToken, setCaptchaToken] = useState("")
    const [error, setError] = useState<string | null>(null)

    function clearCaptcha() {
        setCaptchaToken("")
        setError(null)
    }

    function resetCaptcha() {
        clearCaptcha()
        ref.current?.reset()
    }

    return {
        captchaToken,
        clearCaptcha,
        resetCaptcha,
        fieldsProps: { ref, error, setError, setCaptchaToken },
    }
}
