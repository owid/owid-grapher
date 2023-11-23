import React from "react"
import { SiteNavigation } from "./SiteNavigation.js"

interface SiteHeaderProps {
    hideAlertBanner?: boolean
    hideDonationFlag?: boolean
    baseUrl: string
}

export const SiteHeader = (props: SiteHeaderProps) => (
    <header className="site-header">
        <div className="site-navigation-root">
            <SiteNavigation
                baseUrl={props.baseUrl}
                hideDonationFlag={props.hideDonationFlag}
            />
        </div>
    </header>
)
