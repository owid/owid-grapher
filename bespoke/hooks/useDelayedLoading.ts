import { useEffect, useState } from "react"

/**
 * Hook that only returns true after a loading state has persisted for a minimum duration.
 * This prevents loading indicators from flashing for quick operations.
 */
export function useDelayedLoading(isLoading: boolean, delay = 300): boolean {
    const [showLoading, setShowLoading] = useState(false)

    useEffect(() => {
        let timeoutId: NodeJS.Timeout

        if (isLoading) {
            timeoutId = setTimeout(() => setShowLoading(true), delay)
        } else {
            setShowLoading(false)
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [isLoading, delay])

    return showLoading
}
