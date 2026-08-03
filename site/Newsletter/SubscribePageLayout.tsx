import { ReactNode, useEffect, useRef } from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCheck } from "@fortawesome/free-solid-svg-icons"

/**
 * The pieces shared by the two email notification pages (/subscribe and
 * /subscribe/preferences). Both render into a `main.subscribe-page` grid, and
 * both swap between an editing screen and a terminal confirmation screen.
 */
export const SUBSCRIBE_PAGE_CONTENT_GRID_CLASSES =
    "span-cols-6 col-start-4 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2"

export const SubscribePageHero = ({
    heading,
    subheading,
}: {
    heading: string
    subheading?: string
}) => (
    <header className="subscribe-page__hero grid grid-cols-12-full-width span-cols-14 col-start-1">
        <div className={SUBSCRIBE_PAGE_CONTENT_GRID_CLASSES}>
            <h1 className="subscribe-page__heading">{heading}</h1>
            {subheading && (
                <p className="subscribe-page__subheading">{subheading}</p>
            )}
        </div>
    </header>
)

/**
 * A terminal screen: subscribed, preferences saved, unsubscribed. It carries its
 * own heading and is rendered *instead of* the hero, so it must be rendered by
 * whichever component owns the page's screen state.
 */
export const SubscribePageConfirmation = ({
    heading,
    children,
    action,
}: {
    heading: string
    children: ReactNode
    action?: { href: string; label: string }
}) => {
    const headingRef = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        // Replacing the page contents is silent to screen readers, and the
        // reader is likely scrolled down to the button they just used.
        window.scrollTo(0, 0)
        headingRef.current?.focus({ preventScroll: true })
    }, [])

    return (
        <div
            className={cx(
                "subscribe-page__confirmation",
                SUBSCRIBE_PAGE_CONTENT_GRID_CLASSES
            )}
        >
            <div className="subscribe-page__confirmation-icon">
                <FontAwesomeIcon icon={faCheck} />
            </div>
            <h1
                className="subscribe-page__heading subscribe-page__confirmation-heading"
                ref={headingRef}
                tabIndex={-1}
            >
                {heading}
            </h1>
            <p className="subscribe-page__confirmation-text">{children}</p>
            {action && (
                <a
                    className="subscribe-page__confirmation-action"
                    href={action.href}
                >
                    {action.label}
                </a>
            )}
        </div>
    )
}
