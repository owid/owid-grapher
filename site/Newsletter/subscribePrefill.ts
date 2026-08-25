/**
 * Hand-off from the small newsletter signup forms to /subscribe when "Follow
 * Topics" is ticked: kept in sessionStorage rather than the URL so the email
 * address never lands in history, analytics or referrers.
 */

const STORAGE_KEY = "owid-subscribe-prefill"

export interface SubscribePrefill {
    email: string
    subscribeToOwidBrief: boolean
}

export function storeSubscribePrefill(prefill: SubscribePrefill): void {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefill))
    } catch {
        // Storage can be unavailable (private mode, blocked site data); the
        // subscribe page then just starts from its defaults.
    }
}

/** Reads and clears the hand-off, so a later visit starts fresh. */
export function takeSubscribePrefill(): SubscribePrefill | undefined {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (!raw) return undefined
        sessionStorage.removeItem(STORAGE_KEY)
        const parsed: unknown = JSON.parse(raw)
        if (
            typeof parsed !== "object" ||
            parsed === null ||
            typeof (parsed as SubscribePrefill).email !== "string"
        )
            return undefined
        return {
            email: (parsed as SubscribePrefill).email,
            subscribeToOwidBrief: !!(parsed as SubscribePrefill)
                .subscribeToOwidBrief,
        }
    } catch {
        return undefined
    }
}
