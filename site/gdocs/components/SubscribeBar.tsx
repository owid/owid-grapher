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
                    <h4 className="h6-black-caps">
                        Subscribe to our newsletters
                    </h4>
                    <FontAwesomeIcon icon={faEnvelopeOpenText} />
                    <h5 className="h4-semibold">
                        Receive our latest work by email
                    </h5>
                </div>
                <p className="subscribe-bar__p body-3-medium">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                    Nunc vulputate libero et velit interdum, ac aliquet odio
                    mattis.
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
