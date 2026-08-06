import { useState } from "react"
import { getErrorMessage } from "./emailNotificationsApi.js"

interface ApiSubmitState {
    isSubmitting: boolean
    errorMessage: string | null
    setErrorMessage: (message: string | null) => void
    /** Runs the callback with the choreography below; never throws. */
    submit: (callback: () => Promise<void>) => Promise<void>
}

/**
 * The submit choreography shared by the email-notifications forms: clear any
 * previous error, mark the request as in flight, and turn a thrown error into
 * a user-facing message (ApiError messages verbatim, anything else generic).
 */
export function useApiSubmit(): ApiSubmitState {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const submit = async (callback: () => Promise<void>): Promise<void> => {
        setErrorMessage(null)
        setIsSubmitting(true)
        try {
            await callback()
        } catch (error) {
            setErrorMessage(getErrorMessage(error))
        } finally {
            setIsSubmitting(false)
        }
    }

    return { isSubmitting, errorMessage, setErrorMessage, submit }
}
