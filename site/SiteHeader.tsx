import { ArchiveMetaInformation } from "@ourworldindata/types"
import {
    ArchiveWritingNavigation,
    ArchiveDataNavigation,
} from "./archive/ArchiveNavigation.js"
import { SiteNavigation } from "./SiteNavigation.js"

interface SiteHeaderProps {
    hideDonationFlag?: boolean
    /**
     * Stops the search bar from being rendered, as we show it in the page content on the homepage
     */
    isOnHomepage?: boolean

    // If this is an archived page, we need to render a different version of the site header
    archiveInfo?: ArchiveMetaInformation
}

export const SiteHeaderNavigation = (props: SiteHeaderProps) => {
    const archiveInfo = props.archiveInfo
    if (archiveInfo?.archiveNavigation) {
        const archiveNavigation = archiveInfo.archiveNavigation
        const nav =
            archiveNavigation.contentType === "writing" ? (
                <ArchiveWritingNavigation
                    archivalDate={archiveInfo.archivalDate}
                    {...archiveNavigation}
                />
            ) : (
                <ArchiveDataNavigation
                    archivalDate={archiveInfo.archivalDate}
                    {...archiveNavigation}
                />
            )
        return nav
    }

    return (
        <SiteNavigation
            hideDonationFlag={props.hideDonationFlag}
            isOnHomepage={props.isOnHomepage}
        />
    )
}

export const SiteHeader = (props: SiteHeaderProps) => (
    <header className="site-header">
        <div className="site-navigation-root">
            <SiteHeaderNavigation {...props} />
        </div>
    </header>
)
