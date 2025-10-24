import cx from "classnames"
import { EnrichedBlockSubscribeBar } from "@ourworldindata/utils"
import { Button } from "@ourworldindata/components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faEnvelopeOpenText } from "@fortawesome/free-solid-svg-icons"

export default function SubscribeBar({
    d,
    className = "",
}: {
    d: EnrichedBlockSubscribeBar
    className?: string
}) {
    return (
        <div
            className={cx(
                className,
                "subscribe-bar",
                `subscribe-bar--${d.align}`
            )}
        >
            <div className="subscribe-bar__text">
                <div className="subscribe-bar__header">
                    <FontAwesomeIcon icon={faEnvelopeOpenText} />
                    <h5 className="h4-semibold">
                        Subscribe to our newsletters
                    </h5>
                </div>
                <p className="subscribe-bar__p body-3-medium">
                    We send two regular newsletters so you can stay up to date
                    on our work and receive curated highlights from across Our
                    World in Data.
                </p>
            </div>
            <Button
                className="subscribe-bar__button"
                theme="solid-vermillion"
                text="Subscribe"
                href="/subscribe"
                icon={null}
            />
        </div>
    )
}
