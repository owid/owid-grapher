import { FRONTIER_START_YEAR } from "../core/frontier.js"

/**
 * The authored subtitle, plus a sentence on the frontier models missing
 * since 2024 whose link zooms in on them
 */
export function ChartSubtitle({
    subtitle,
    onShowFrontier,
}: {
    subtitle: string
    onShowFrontier: () => void
}) {
    return (
        <>
            {subtitle} Since {FRONTIER_START_YEAR}, many of the most capable AI
            models can&rsquo;t be shown because of a{" "}
            <button
                type="button"
                className="ai-training-compute__inline-link"
                onClick={onShowFrontier}
            >
                lack of transparency
            </button>{" "}
            about how they were trained.
        </>
    )
}
