import ReactDOM from "react-dom"
import { getOwidGdocFromJSON, OwidGdocType } from "@ourworldindata/utils"
import { SiteNavigation } from "./SiteNavigation"

export const runSiteNavigation = (
    baseUrl: string,
    hideDonationFlag?: boolean
) => {
    // Used to determine whether or not to show the searchbar in the header
    let isOnHomepage = false
    if (window._OWID_GDOC_PROPS) {
        const props = getOwidGdocFromJSON(window._OWID_GDOC_PROPS)
        isOnHomepage = props?.content?.type === OwidGdocType.Homepage
    }
    ReactDOM.render(
        <SiteNavigation
            baseUrl={baseUrl}
            hideDonationFlag={hideDonationFlag}
            isOnHomepage={isOnHomepage}
        />,
        document.querySelector(".site-navigation-root")
    )
}
