import cx from "classnames"
import { faXmark } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Button, TextInput } from "@ourworldindata/components"
import { SiteAnalytics } from "../../SiteAnalytics.js"
import { NewsletterSubscriptionContext } from "../../newsletter.js"
import { NewsletterIcon } from "./NewsletterIcon.js"

const analytics = new SiteAnalytics()

export default function DataInsightsNewsletter({
    className,
    context,
    onClose,
}: {
    className?: string
    context:
        | NewsletterSubscriptionContext.HomepageDataInsights
        | NewsletterSubscriptionContext.FloatingDataInsights
    onClose?: () => void
}) {
    return (
        <div
            className={cx(
                "data-insights-newsletter grid grid-cols-12-full-width span-cols-14",
                { "data-insights-newsletter--has-close": onClose },
                className
            )}
        >
            {onClose && (
                <div className="data-insights-newsletter__close span-rows-1 span-cols-12 col-start-2">
                    <button
                        className="data-insights-newsletter__close-button"
                        onClick={onClose}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
            )}
            <div className="data-insights-newsletter__inner span-cols-12 col-start-2">
                <div className="data-insights-newsletter__left">
                    <NewsletterIcon className="data-insights-newsletter__icon" />
                    <div className="data-insights-newsletter__left__text">
                        <h3 className="data-insights-newsletter__heading h3-bold">
                            Get Data Insights delivered to your inbox
                        </h3>
                        <p className="data-insights-newsletter__description body-3-medium">
                            Receive an email from us when we publish a Data
                            Insight (every few days).
                        </p>
                    </div>
                </div>
                <div className="data-insights-newsletter__right">
                    <form
                        className="data-insights-newsletter__form"
                        action="https://ourworldindata.us8.list-manage.com/subscribe/post?u=18058af086319ba6afad752ec&id=2e166c1fc1"
                        method="post"
                        target="_blank"
                        onSubmit={() =>
                            analytics.logSiteFormSubmit(
                                "newsletter-subscribe",
                                `Subscribe [${context}]`
                            )
                        }
                    >
                        <TextInput
                            className="data-insights-newsletter__email-input sentry-mask"
                            type="email"
                            name="EMAIL"
                            required={true}
                            size={1} // Keep shrinking on a very small screen.
                            placeholder="Your email address"
                        />
                        <input type="hidden" name="group[85302][16]" value="" />
                        <Button
                            ariaLabel="Subscribe to the Data Insights newsletter"
                            theme="solid-vermillion"
                            text="Subscribe"
                            type="submit"
                            icon={null}
                            onClick={() =>
                                analytics.logSiteClick(
                                    "newsletter-subscribe",
                                    `Subscribe [${context}]`
                                )
                            }
                        />
                    </form>
                    <p className="data-insights-newsletter__note note-1-medium">
                        By subscribing you are agreeing to the terms of our{" "}
                        <a href="/privacy-policy">privacy policy</a>.
                    </p>
                </div>
            </div>
        </div>
    )
}
