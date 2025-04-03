import { SiteNavigation } from "./SiteNavigation.js"

interface SiteHeaderProps {
    hideAlertBanner?: boolean
    hideDonationFlag?: boolean
    /**
     * Stops the search bar from being rendered, as we show it in the page content on the homepage
     */
    isOnHomepage?: boolean
}

export const SiteHeader = (props: SiteHeaderProps) => (
    <header className="site-header">
        <div className="site-navigation-root">
            <SiteNavigation
                hideDonationFlag={props.hideDonationFlag}
                isOnHomepage={props.isOnHomepage}
            />
        </div>
    </header>
)
