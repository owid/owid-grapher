import { ArchiveSiteNavigationInfo } from "@ourworldindata/types"
import { ArchiveSiteNavigation } from "./archive/ArchiveSiteNavigation.js"
import { SiteNavigation } from "./SiteNavigation.js"

interface SiteHeaderProps {
    hideAlertBanner?: boolean
    hideDonationFlag?: boolean
    /**
     * Stops the search bar from being rendered, as we show it in the page content on the homepage
     */
    isOnHomepage?: boolean

    // If this is an archived page, we need to render a different version of the site header
    archiveNavInformation?: ArchiveSiteNavigationInfo
}

export const SiteHeader = (props: SiteHeaderProps) => (
    <header className="site-header">
        {props.archiveNavInformation ? (
            <ArchiveSiteNavigation {...props.archiveNavInformation} />
        ) : (
            <div className="site-navigation-root">
                <SiteNavigation
                    hideDonationFlag={props.hideDonationFlag}
                    isOnHomepage={props.isOnHomepage}
                />
            </div>
        )}
    </header>
)
