import cx from "classnames"
import { EnrichedBlockSubscribeBanner } from "@ourworldindata/utils"
import { Button } from "@ourworldindata/components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faEnvelopeOpenText } from "@fortawesome/free-solid-svg-icons"

export default function SubscribeBanner({
    d,
    className = "",
}: {
    d: EnrichedBlockSubscribeBanner
    className?: string
}) {
    return (
        <div
            className={cx(
                className,
                "subscribe-banner",
                `subscribe-banner--${d.align}`
            )}
        >
            <div className="subscribe-banner__text">
                <div className="subscribe-banner__header">
                    <FontAwesomeIcon icon={faEnvelopeOpenText} />
                    <h5 className="h4-semibold">
                        Subscribe to our newsletters
                    </h5>
                </div>
                <p className="subscribe-banner__p body-3-medium">
                    We send two regular newsletters so you can stay up to date
                    on our work and receive curated highlights from across Our
                    World in Data.
                </p>
            </div>
            <Button
                className="subscribe-banner__button"
                theme="solid-vermillion"
                text="Subscribe"
                href="/subscribe"
                icon={null}
            />
        </div>
    )
}
