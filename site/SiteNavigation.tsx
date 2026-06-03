import { useState, useCallback, useEffect, useRef } from "react"
import { getExperimentState } from "@ourworldindata/utils"
import { SiteAnalytics } from "./SiteAnalytics.js"
import {
    faListUl,
    faBars,
    faXmark,
    faEnvelopeOpenText,
} from "@fortawesome/free-solid-svg-icons"
import { NewsletterSubscriptionContext } from "./newsletter.js"
import {
    NewsletterSubscriptionForm,
    NewsletterSubscriptionHeader,
} from "./NewsletterSubscription.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { SiteNavigationTopics } from "./SiteNavigationTopics.js"
import { SiteLogos } from "./SiteLogos.js"
import { SiteAbout } from "./SiteAbout.js"
import { SiteResources } from "./SiteResources.js"
import { SiteSearchNavigation } from "./SiteSearchNavigation.js"
import { SiteMobileMenu } from "./SiteMobileMenu.js"
import { SiteNavigationToggle } from "./SiteNavigationToggle.js"
import { buildLatestPagePath } from "./latest/latestUtils.js"
import classnames from "classnames"
import { useTriggerOnEscape } from "./hooks.js"
import { useTopicTagGraph } from "./search/searchHooks.js"
import {
    AUTOCOMPLETE_CONTAINER_ID,
    DETACHED_MODE_MAX_WIDTH,
} from "./search/Autocomplete.js"
import { Menu } from "./SiteConstants.js"
import { SEARCH_BASE_PATH } from "./search/searchUtils.js"

// Note: tranforming the flag from an env string to a boolean in
// clientSettings.ts is convoluted due to the two-pass SSR/Vite build process.
const HAS_DONATION_FLAG = false

const TOPNAV_EXPERIMENT_ID = "exp-topnav-v1"
const TOPNAV_HIDE_THRESHOLD_PX = 120
const TOPNAV_SCROLL_DELTA_PX = 6

const analytics = new SiteAnalytics()

export const SiteNavigation = ({
    hideDonationFlag,
    isOnHomepage,
    isPreviewing,
}: {
    hideDonationFlag?: boolean
    isOnHomepage?: boolean
    isPreviewing?: boolean
}) => {
    const [menu, setActiveMenu] = useState<Menu | null>(null)
    const [query, setQuery] = useState<string>("")
    const { data: tagGraph } = useTopicTagGraph({
        isPreviewing: Boolean(isPreviewing),
    })

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
            // Only run when screen size is large, .aa-DetachedContainer gets positioned correctly
            if (window.innerWidth <= DETACHED_MODE_MAX_WIDTH) return
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

    useTriggerOnEscape(closeOverlay, { active: menu !== null })

    // Experiment topnav-v1: log a one-shot view event for treatment arms so we
    // can split engagement metrics by arm in GA.
    useEffect(() => {
        const arm = getExperimentState()[TOPNAV_EXPERIMENT_ID]?.arm
        if (arm === "sticky" || arm === "show-on-scroll-up") {
            analytics.logTopnavView(arm)
        }
    }, [])

    // Experiment topnav-v1, show-on-scroll-up arm: hide the header on scroll-down,
    // reveal it on scroll-up. Body class .exp-topnav-v1--show-on-scroll-up is set
    // by the CF middleware; this effect adds/removes .site-header--hidden.
    const menuRef = useRef(menu)
    menuRef.current = menu
    useEffect(() => {
        const arm = getExperimentState()[TOPNAV_EXPERIMENT_ID]?.arm
        if (arm !== "show-on-scroll-up") return

        const header = document.querySelector<HTMLElement>(".site-header")
        if (!header) return

        let lastY = window.scrollY
        let ticking = false

        const update = () => {
            ticking = false
            const y = window.scrollY
            const delta = y - lastY
            if (Math.abs(delta) < TOPNAV_SCROLL_DELTA_PX) return
            // Keep the header visible while a menu/dropdown is open so its
            // anchor doesn't slide out from under the user.
            if (menuRef.current !== null) {
                header.classList.remove("site-header--hidden")
            } else if (delta > 0 && y > TOPNAV_HIDE_THRESHOLD_PX) {
                header.classList.add("site-header--hidden")
            } else if (delta < 0) {
                header.classList.remove("site-header--hidden")
            }
            lastY = y
        }

        const onScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(update)
                ticking = true
            }
        }

        window.addEventListener("scroll", onScroll, { passive: true })
        return () => {
            window.removeEventListener("scroll", onScroll)
            header.classList.remove("site-header--hidden")
        }
    }, [])

    // Whenever a menu opens, immediately reveal the header.
    useEffect(() => {
        if (menu === null) return
        const header = document.querySelector<HTMLElement>(".site-header")
        header?.classList.remove("site-header--hidden")
    }, [menu])

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
                            ariaLabel="Toggle menu"
                            isActive={isActiveMobileMenu}
                            onToggle={() => toggleMenu(Menu.Topics)}
                            className="SiteNavigationToggle--mobile-menu hide-sm-up"
                            dropdown={
                                <SiteMobileMenu
                                    menu={menu}
                                    toggleMenu={toggleMenu}
                                    tagGraph={tagGraph}
                                    className="hide-sm-up"
                                />
                            }
                        >
                            <FontAwesomeIcon
                                icon={isActiveMobileMenu ? faXmark : faBars}
                            />
                        </SiteNavigationToggle>
                        <SiteLogos />
                        <nav className="site-primary-links hide-sm-only">
                            <ul>
                                <li>
                                    <SiteNavigationToggle
                                        ariaLabel="Toggle topics menu"
                                        isActive={menu === Menu.Topics}
                                        onToggle={() => toggleMenu(Menu.Topics)}
                                        dropdown={
                                            <SiteNavigationTopics
                                                onClose={closeOverlay}
                                                tagGraph={tagGraph}
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
                                    <a href={SEARCH_BASE_PATH}>Data</a>
                                </li>
                                <li>
                                    <a href={buildLatestPagePath()}>Latest</a>
                                </li>
                                <li className="with-relative-dropdown">
                                    <SiteNavigationToggle
                                        ariaLabel="Toggle resources menu"
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
                                <li className="with-relative-dropdown">
                                    <SiteNavigationToggle
                                        ariaLabel="Toggle about menu"
                                        isActive={menu === Menu.About}
                                        onToggle={() => toggleMenu(Menu.About)}
                                        dropdown={<SiteAbout />}
                                        withCaret={true}
                                    >
                                        About
                                    </SiteNavigationToggle>
                                </li>
                            </ul>
                        </nav>
                        <div className="site-search-cta">
                            {!isOnHomepage && (
                                <SiteSearchNavigation
                                    isActive={menu === Menu.Search}
                                    onClose={closeOverlay}
                                    onActivate={setSearchAsActiveMenu}
                                    isPreviewing={isPreviewing}
                                />
                            )}
                            <SiteNavigationToggle
                                ariaLabel="Toggle subscribe menu"
                                isActive={menu === Menu.Subscribe}
                                onToggle={() => toggleMenu(Menu.Subscribe)}
                                dropdown={
                                    <>
                                        <NewsletterSubscriptionHeader />
                                        <NewsletterSubscriptionForm
                                            context={
                                                NewsletterSubscriptionContext.Floating
                                            }
                                        />
                                    </>
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
                </div>
            </div>
            {HAS_DONATION_FLAG && !hideDonationFlag && (
                <a href="/donate" className="site-navigation__giving">
                    It’s Giving Season. Help us do more with a donation.
                </a>
            )}
        </>
    )
}
