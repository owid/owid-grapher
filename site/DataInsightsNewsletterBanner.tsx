import * as React from "react"
import { useState, useEffect } from "react"
import cx from "classnames"
import DataInsightsNewsletter from "./gdocs/components/DataInsightsNewsletter.js"

export default function DataInsightsNewsletterBanner() {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setIsVisible(true)
        }, 3000)
        return () => clearTimeout(timeoutId)
    }, [])

    return (
        <DataInsightsNewsletter
            className={cx("data-insights-newsletter-banner", {
                "data-insights-newsletter-banner--visible": isVisible,
            })}
            onClose={() => setIsVisible(false)}
        />
    )
}
