import { useState } from "react"

/**
 * Prototype aid: `dp…` URL params that couldn't be used (a typo, an unknown
 * value) are shown in a small bar, not silently ignored — otherwise a
 * misspelled variant looks like a bug.
 */
export function DataPerspectivesIgnoredParams({
    ignored,
}: {
    ignored: string[]
}) {
    const [dismissed, setDismissed] = useState(false)
    if (dismissed || ignored.length === 0) return null
    return (
        <div className="dp-ignored-params" role="status">
            <span>
                Ignored: <code>{ignored.join("  ")}</code>
            </span>
            <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setDismissed(true)}
            >
                ×
            </button>
        </div>
    )
}
