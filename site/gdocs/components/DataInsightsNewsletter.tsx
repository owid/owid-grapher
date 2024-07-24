import * as React from "react"
import cx from "classnames"
import { faXmark } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Button, TextInput } from "@ourworldindata/components"
import { SiteAnalytics } from "../../SiteAnalytics.js"
import { NewsletterSubscriptionContext } from "../../newsletter.js"

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
                    <Icon className="data-insights-newsletter__icon" />
                    <div className="data-insights-newsletter__left__text">
                        <h3 className="data-insights-newsletter__heading h3-bold">
                            Get Daily Data Insights delivered to your inbox
                        </h3>
                        <p className="data-insights-newsletter__description body-3-medium">
                            Receive an email from us whenever we publish a Daily
                            Data Insight (maximum 1 per day).
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
                            className="data-insights-newsletter__email-input"
                            type="email"
                            name="EMAIL"
                            required={true}
                            size={1} // Keep shrinking on a very small screen.
                            placeholder="Your email address"
                        />
                        <input type="hidden" name="group[85302][16]" value="" />
                        <Button
                            theme="solid-vermillion"
                            text="Subscribe"
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

function Icon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <circle cx="24" cy="24" r="24" fill="#DBE5F0" />
            <rect
                x="11.2676"
                y="19.3955"
                width="25.4664"
                height="17.3389"
                rx="2.70925"
                fill="white"
            />
            <rect
                x="15.0605"
                y="11.8096"
                width="17.8807"
                height="13.0041"
                fill="white"
            />
            <path
                d="M11.268 21.107C11.2238 21.2788 11.2002 21.4564 11.2002 21.6383V34.1352C11.2002 34.6771 11.364 35.1768 11.6391 35.5977L20.1865 28.5774L11.2685 21.107H11.268Z"
                fill="#46688F"
            />
            <path
                d="M36.731 21.1088L27.8145 28.5774L36.3612 35.5972C36.6386 35.1758 36.8002 34.675 36.8002 34.1352V21.6383C36.8002 21.4575 36.7756 21.2798 36.7303 21.1087L36.731 21.1088Z"
                fill="#46688F"
            />
            <path
                d="M15.467 12.8C15.467 12.5061 15.7059 12.2667 16.0004 12.2667H32.0016C32.296 12.2667 32.5349 12.5061 32.5349 12.8V23.2089L36.2026 20.1367C36.098 20.0268 35.9881 19.9207 35.8618 19.8316L33.6018 18.0528V12.8001C33.6018 11.9179 32.8839 11.2 32.0017 11.2H16.0005C15.1183 11.2 14.4004 11.9179 14.4004 12.8001V18.0528L12.1656 19.8129C12.0301 19.9078 11.9122 20.0204 11.8008 20.1377L15.4673 23.2088L15.467 12.8Z"
                fill="#46688F"
            />
            <path
                d="M22.9858 27.6593L12.3945 36.358C12.8186 36.638 13.3247 36.8022 13.8678 36.8022H34.1359C34.6805 36.8022 35.1855 36.6358 35.6069 36.3563L25.018 27.6591C24.4292 27.1752 23.5747 27.1752 22.9864 27.6591L22.9858 27.6593Z"
                fill="#46688F"
            />
            <path
                d="M20.0727 15.9336C20.3605 15.9336 20.6145 16.1876 20.6145 16.4754V22.1643C20.6145 22.3167 20.733 22.4352 20.8853 22.4352H27.6578C27.9456 22.4352 28.1996 22.6892 28.1996 22.977C28.1996 23.2818 27.9456 23.5188 27.6578 23.5188H20.8853C20.1234 23.5188 19.5309 22.9262 19.5309 22.1643V16.4754C19.5309 16.1876 19.7679 15.9336 20.0727 15.9336ZM22.2398 19.1844C22.5277 19.1844 22.7816 19.4384 22.7816 19.7262V20.8098C22.7816 21.1146 22.5277 21.3516 22.2398 21.3516C21.9351 21.3516 21.698 21.1146 21.698 20.8098V19.7262C21.698 19.4384 21.9351 19.1844 22.2398 19.1844ZM24.407 18.1008V20.8098C24.407 21.1146 24.1531 21.3516 23.8652 21.3516C23.5605 21.3516 23.3234 21.1146 23.3234 20.8098V18.1008C23.3234 17.813 23.5605 17.559 23.8652 17.559C24.1531 17.559 24.407 17.813 24.407 18.1008ZM25.4906 18.6426C25.7784 18.6426 26.0324 18.8966 26.0324 19.1844V20.8098C26.0324 21.1146 25.7784 21.3516 25.4906 21.3516C25.1859 21.3516 24.9488 21.1146 24.9488 20.8098V19.1844C24.9488 18.8966 25.1859 18.6426 25.4906 18.6426ZM27.6578 17.0172V20.8098C27.6578 21.1146 27.4038 21.3516 27.116 21.3516C26.8112 21.3516 26.5742 21.1146 26.5742 20.8098V17.0172C26.5742 16.7294 26.8112 16.4754 27.116 16.4754C27.4038 16.4754 27.6578 16.7294 27.6578 17.0172Z"
                fill="#98A9BD"
            />
        </svg>
    )
}
