import { LatestNewsletterSlot } from "./LatestNewsletterSlot.js"
import { LATEST_HIT_GRID_CLASSES } from "./latestUtils.js"

const LatestHitSkeleton = () => (
    <div
        className={`latest-hit-skeleton animate-pulse ${LATEST_HIT_GRID_CLASSES}`}
        aria-hidden="true"
    >
        <div className="latest-hit-skeleton__metadata">
            <div className="latest-hit-skeleton__metadata-bar" />
            <div className="latest-hit-skeleton__metadata-date" />
        </div>
        <div className="latest-hit-skeleton__card grid grid-cols-8">
            <div className="latest-hit-skeleton__image span-cols-3" />
            <div className="latest-hit-skeleton__content span-cols-5">
                <div className="latest-hit-skeleton__title" />
                <div className="latest-hit-skeleton__byline" />
                <div className="latest-hit-skeleton__excerpt-line" />
                <div className="latest-hit-skeleton__excerpt-line latest-hit-skeleton__excerpt-line--short" />
            </div>
        </div>
    </div>
)

// The newsletter slot is rendered for real (not as a pulsing placeholder) so it
// doesn't change identity between the skeleton and the loaded feed. `topicArea`
// is threaded through for the same reason: with a topic filter in the URL the
// slot must already show that area's card while the first query is in flight.
export const LatestSearchSkeleton = ({ topicArea }: { topicArea?: string }) => (
    <>
        <LatestHitSkeleton />
        <LatestHitSkeleton />
        <LatestNewsletterSlot topicArea={topicArea} />
        <LatestHitSkeleton />
    </>
)
