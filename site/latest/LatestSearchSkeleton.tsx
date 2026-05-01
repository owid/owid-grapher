import { NewsletterSignupBlock } from "../NewsletterSignupBlock.js"
import { NewsletterSubscriptionContext } from "../newsletter.js"
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

export const LatestSearchSkeleton = () => (
    <>
        <LatestHitSkeleton />
        <LatestHitSkeleton />
        <NewsletterSignupBlock
            className="latest-page__newsletter-signup col-start-11 span-cols-3 col-lg-start-10 span-lg-cols-4 span-md-cols-14 col-md-start-1"
            context={NewsletterSubscriptionContext.Latest}
        />
        <LatestHitSkeleton />
    </>
)
