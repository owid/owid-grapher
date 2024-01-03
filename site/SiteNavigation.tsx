import React, { useCallback, useEffect, useState } from "react"
import ReactDOM from "react-dom"
import {
    faListUl,
    faBars,
    faXmark,
    faEnvelopeOpenText,
} from "@fortawesome/free-solid-svg-icons"
import {
    NewsletterSubscriptionContext,
    NewsletterSubscriptionForm,
} from "./NewsletterSubscription.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { SiteNavigationTopics } from "./SiteNavigationTopics.js"
import { SiteLogos } from "./SiteLogos.js"
import { CategoryWithEntries } from "@ourworldindata/utils"
import { SiteResources } from "./SiteResources.js"
import { SiteSearchNavigation } from "./SiteSearchNavigation.js"
import { SiteMobileMenu } from "./SiteMobileMenu.js"
import { SiteNavigationToggle } from "./SiteNavigationToggle.js"
import classnames from "classnames"
import { useTriggerOnEscape } from "./hooks.js"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { AUTOCOMPLETE_CONTAINER_ID } from "./search/Autocomplete.js"

export enum Menu {
    Topics = "topics",
    Resources = "resources",
    About = "about",
    Subscribe = "subscribe",
    Search = "search",
}

// Note: tranforming the flag from an env string to a boolean in
// clientSettings.ts is convoluted due to the two-pass SSR/Vite build process.
const HAS_DONATION_FLAG = false

export const SiteNavigation = ({
    baseUrl,
    hideDonationFlag,
}: {
    baseUrl: string
    hideDonationFlag?: boolean
}) => {
    const [menu, setActiveMenu] = React.useState<Menu | null>(null)
    const [categorizedTopics, setCategorizedTopics] = useState<
        CategoryWithEntries[]
    >([])
    const [query, setQuery] = React.useState<string>("")

    const isActiveMobileMenu =
        menu !== null &&
        [Menu.Topics, Menu.Resources, Menu.About].includes(menu)

    // useCallback so as to not trigger a re-render for SiteSearchNavigation, which remounts
    // Autocomplete and breaks it
    const closeOverlay = useCallback(() => {
        setActiveMenu(null)
        setQuery("")
    }, [])

    // Same SiteSearchNavigation re-rendering case as above
    const setSearchAsActiveMenu = useCallback(() => {
        setActiveMenu(Menu.Search)
        // Forced DOM manipulation of the algolia autocomplete panel position 🙃
        // Without this, the panel initially renders at the same width as the shrunk search input
        // Fortunately we only have to do this when it mounts - it takes care of resizes
        setTimeout(() => {
            const [panel, autocompleteContainer] = [
                ".aa-Panel",
                AUTOCOMPLETE_CONTAINER_ID,
            ].map((className) => document.querySelector<HTMLElement>(className))
            if (panel && autocompleteContainer) {
                const bounds = autocompleteContainer.getBoundingClientRect()
                panel.style.left = `${bounds.left}px`
            }
        }, 10)

        setTimeout(() => {
            const input = document.querySelector<HTMLElement>(".aa-Input")
            if (input) {
                input.focus()
                input.setAttribute("required", "true")
            }
        }, 10)
    }, [])

    const toggleMenu = (root: Menu) => {
        if (menu === root) {
            closeOverlay()
        } else {
            setActiveMenu(root)
        }
    }

    // Open overlay back when query entered after pressing "esc"
    useEffect(() => {
        if (query) {
            setActiveMenu(Menu.Search)
        }
    }, [query])

    useEffect(() => {
        const fetchCategorizedTopics = async () => {
            const response = await fetch(`${BAKED_BASE_URL}/headerMenu.json`, {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    Accept: "application/json",
                },
            })
            const json = await response.json()
            setCategorizedTopics(json.categories)
        }
        fetchCategorizedTopics()
    }, [])

    useTriggerOnEscape(closeOverlay)

    return (
        <>
            {menu && <div className="overlay" onClick={closeOverlay} />}
            <div className="site-navigation">
                <div className="wrapper">
                    <div
                        className={classnames("site-navigation-bar", {
                            "search-active": menu === Menu.Search,
                        })}
                    >
                        <SiteNavigationToggle
                            isActive={isActiveMobileMenu}
                            onToggle={() => toggleMenu(Menu.Topics)}
                            className="SiteNavigationToggle--mobile-menu hide-sm-up"
                            dropdown={
                                <SiteMobileMenu
                                    menu={menu}
                                    toggleMenu={toggleMenu}
                                    topics={categorizedTopics}
                                    className="hide-sm-up"
                                />
                            }
                        >
                            <FontAwesomeIcon
                                icon={isActiveMobileMenu ? faXmark : faBars}
                            />
                        </SiteNavigationToggle>
                        <SiteLogos baseUrl={baseUrl} />
                        <nav className="site-primary-links hide-sm-only">
                            <ul>
                                <li>
                                    <SiteNavigationToggle
                                        isActive={menu === Menu.Topics}
                                        onToggle={() => toggleMenu(Menu.Topics)}
                                        dropdown={
                                            <SiteNavigationTopics
                                                onClose={closeOverlay}
                                                topics={categorizedTopics}
                                                className="hide-sm-only"
                                            />
                                        }
                                        className="topics"
                                    >
                                        <FontAwesomeIcon
                                            icon={faListUl}
                                            style={{ marginRight: "8px" }}
                                        />
                                        Browse by topic
                                    </SiteNavigationToggle>
                                </li>
                                <li>
                                    <a href="/latest">Latest</a>
                                </li>
                                <li className="with-relative-dropdown">
                                    <SiteNavigationToggle
                                        isActive={menu === Menu.Resources}
                                        onToggle={() =>
                                            toggleMenu(Menu.Resources)
                                        }
                                        dropdown={<SiteResources />}
                                        withCaret={true}
                                    >
                                        Resources
                                    </SiteNavigationToggle>
                                </li>
                                <li>
                                    <a href="/about">About</a>
                                </li>
                            </ul>
                        </nav>
                        <div className="site-search-cta">
                            <SiteSearchNavigation
                                isActive={menu === Menu.Search}
                                onClose={closeOverlay}
                                onActivate={setSearchAsActiveMenu}
                            />
                            <SiteNavigationToggle
                                isActive={menu === Menu.Subscribe}
                                onToggle={() => toggleMenu(Menu.Subscribe)}
                                dropdown={
                                    <NewsletterSubscriptionForm
                                        context={
                                            NewsletterSubscriptionContext.Floating
                                        }
                                    />
                                }
                                className="newsletter-subscription"
                            >
                                <span className="hide-lg-down">Subscribe</span>
                                <FontAwesomeIcon
                                    className="hide-lg-up"
                                    icon={
                                        menu === Menu.Subscribe
                                            ? faXmark
                                            : faEnvelopeOpenText
                                    }
                                />
                            </SiteNavigationToggle>
                            <a
                                href="/donate"
                                className="donate"
                                data-track-note="header_navigation"
                            >
                                Donate
                            </a>
                        </div>
                    </div>
                    {HAS_DONATION_FLAG && !hideDonationFlag && (
                        <a href="/donate" className="site-navigation__giving">
                            Giving season
                        </a>
                    )}
                </div>
            </div>
        </>
    )
}

export const runSiteNavigation = (
    baseUrl: string,
    hideDonationFlag?: boolean
) => {
    ReactDOM.render(
        <SiteNavigation
            baseUrl={baseUrl}
            hideDonationFlag={hideDonationFlag}
        />,
        document.querySelector(".site-navigation-root")
    )
}
