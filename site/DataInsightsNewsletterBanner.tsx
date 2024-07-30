import * as React from "react"
import { useState, useEffect } from "react"
import Cookies from "js-cookie"
import cx from "classnames"
import { COOKIE_NAME as PREFERENCES_COOKIE_NAME } from "./CookiePreferencesManager.js"
import { NewsletterSubscriptionContext } from "./newsletter.js"
import DataInsightsNewsletter from "./gdocs/components/DataInsightsNewsletter.js"

const COOKIE_NAME = "is_data_insights_newsletter_banner_hidden"

export default function DataInsightsNewsletterBanner() {
    const [isVisible, setIsVisible] = useState(false)
    const [isHiding, setIsHiding] = useState(false)

    useEffect(() => {
        const keepHidden =
            Cookies.get(COOKIE_NAME) || !Cookies.get(PREFERENCES_COOKIE_NAME)
        if (keepHidden) return
        const timeoutId = setTimeout(() => {
            setIsVisible(true)
        }, 3000)
        return () => clearTimeout(timeoutId)
    }, [])

    function handleOnClose() {
        setIsHiding(true)
        Cookies.set(COOKIE_NAME, "true", { expires: 90 })
        setTimeout(() => {
            setIsVisible(false)
            setIsHiding(false)
        }, 300) // This should match the transition duration in CSS
    }

    return (
        <DataInsightsNewsletter
            className={cx("data-insights-newsletter-banner", {
                "data-insights-newsletter-banner--visible": isVisible,
                "data-insights-newsletter-banner--hiding": isHiding,
            })}
            context={NewsletterSubscriptionContext.FloatingDataInsights}
            onClose={handleOnClose}
        />
    )
}
