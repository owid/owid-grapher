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

export const SiteNavigationStatic: { categories: CategoryWithEntries[] } = {
    categories: [
        {
            name: "Population and Demographic Change",
            slug: "population",
            entries: [],
            subcategories: [
                {
                    name: "Population Change",
                    slug: "population-change",
                    entries: [
                        {
                            slug: "population-growth",
                            title: "Population Growth",
                        },
                        {
                            slug: "age-structure",
                            title: "Age Structure",
                        },
                        {
                            slug: "gender-ratio",
                            title: "Gender Ratio",
                        },
                    ],
                },
                {
                    name: "Life and Death",
                    slug: "life-and-death",
                    entries: [
                        {
                            slug: "life-expectancy",
                            title: "Life Expectancy",
                        },
                        {
                            slug: "child-mortality",
                            title: "Child and Infant Mortality",
                        },
                        {
                            slug: "fertility-rate",
                            title: "Fertility Rate",
                        },
                    ],
                },
                {
                    name: "Distribution of the World Population",
                    slug: "distribution-of-the-world-population",
                    entries: [
                        {
                            slug: "urbanization",
                            title: "Urbanization",
                        },
                        {
                            slug: "migration",
                            title: "Migration",
                        },
                    ],
                },
            ],
        },
        {
            name: "Health",
            slug: "health",
            entries: [
                {
                    slug: "tuberculosis",
                    title: "Tuberculosis",
                },
                {
                    slug: "pandemics",
                    title: "Pandemics",
                },
                {
                    slug: "cardiovascular-diseases",
                    title: "Cardiovascular Diseases",
                },
            ],
            subcategories: [
                {
                    name: "Health Risks",
                    slug: "health-risks",
                    entries: [
                        {
                            slug: "lead-pollution",
                            title: "Lead Pollution",
                        },
                        {
                            slug: "air-pollution",
                            title: "Air Pollution",
                        },
                        {
                            slug: "outdoor-air-pollution",
                            title: "Outdoor Air Pollution",
                        },
                        {
                            slug: "indoor-air-pollution",
                            title: "Indoor Air Pollution",
                        },
                        {
                            slug: "obesity",
                            title: "Obesity",
                        },
                        {
                            slug: "smoking",
                            title: "Smoking",
                        },
                        {
                            slug: "alcohol-consumption",
                            title: "Alcohol Consumption",
                        },
                        {
                            slug: "illicit-drug-use",
                            title: "Opioids, Cocaine, Cannabis, and Other Illicit Drugs",
                        },
                    ],
                },
                {
                    name: "Infectious Diseases",
                    slug: "infectious-diseases",
                    entries: [
                        {
                            slug: "influenza",
                            title: "Influenza",
                        },
                        {
                            slug: "monkeypox",
                            title: "Mpox (monkeypox)",
                        },
                        {
                            slug: "coronavirus",
                            title: "Coronavirus Pandemic (COVID-19)",
                        },
                        {
                            slug: "hiv-aids",
                            title: "HIV / AIDS",
                        },
                        {
                            slug: "malaria",
                            title: "Malaria",
                        },
                        {
                            slug: "eradication-of-diseases",
                            title: "Eradication of Diseases",
                        },
                        {
                            slug: "diarrheal-diseases",
                            title: "Diarrheal Diseases",
                        },
                        {
                            slug: "smallpox",
                            title: "Smallpox",
                        },
                        {
                            slug: "polio",
                            title: "Polio",
                        },
                        {
                            slug: "pneumonia",
                            title: "Pneumonia",
                        },
                        {
                            slug: "tetanus",
                            title: "Tetanus",
                        },
                    ],
                },
                {
                    name: "Health Institutions and Interventions",
                    slug: "health-institutions-and-interventions",
                    entries: [
                        {
                            slug: "financing-healthcare",
                            title: "Healthcare Spending",
                        },
                        {
                            slug: "vaccination",
                            title: "Vaccination",
                        },
                    ],
                },
                {
                    name: "Life and Death",
                    slug: "life-death-health",
                    entries: [
                        {
                            slug: "life-expectancy",
                            title: "Life Expectancy",
                        },
                        {
                            slug: "child-mortality",
                            title: "Child and Infant Mortality",
                        },
                        {
                            slug: "maternal-mortality",
                            title: "Maternal Mortality",
                        },
                        {
                            slug: "health-meta",
                            title: "Global Health",
                        },
                        {
                            slug: "causes-of-death",
                            title: "Causes of Death",
                        },
                        {
                            slug: "burden-of-disease",
                            title: "Burden of Disease",
                        },
                        {
                            slug: "cancer",
                            title: "Cancer",
                        },
                        {
                            slug: "mental-health",
                            title: "Mental Health",
                        },
                        {
                            slug: "suicide",
                            title: "Suicides",
                        },
                    ],
                },
            ],
        },
        {
            name: "Energy and Environment",
            slug: "environment",
            entries: [],
            subcategories: [
                {
                    name: "Energy",
                    slug: "energy",
                    entries: [
                        {
                            slug: "nuclear-energy",
                            title: "Nuclear Energy",
                        },
                        {
                            slug: "energy-access",
                            title: "Access to Energy",
                        },
                        {
                            slug: "energy",
                            title: "Energy",
                        },
                        {
                            slug: "renewable-energy",
                            title: "Renewable Energy",
                        },
                        {
                            slug: "fossil-fuels",
                            title: "Fossil Fuels",
                        },
                    ],
                },
                {
                    name: "Waste and Pollution",
                    slug: "waste",
                    entries: [
                        {
                            slug: "lead-pollution",
                            title: "Lead Pollution",
                        },
                        {
                            slug: "plastic-pollution",
                            title: "Plastic Pollution",
                        },
                        {
                            slug: "oil-spills",
                            title: "Oil Spills",
                        },
                    ],
                },
                {
                    name: "Air and Climate",
                    slug: "air-and-climate",
                    entries: [
                        {
                            slug: "co2-and-greenhouse-gas-emissions",
                            title: "CO₂ and Greenhouse Gas Emissions",
                        },
                        {
                            slug: "climate-change",
                            title: "Climate Change",
                        },
                        {
                            slug: "air-pollution",
                            title: "Air Pollution",
                        },
                        {
                            slug: "outdoor-air-pollution",
                            title: "Outdoor Air Pollution",
                        },
                        {
                            slug: "indoor-air-pollution",
                            title: "Indoor Air Pollution",
                        },
                        {
                            slug: "ozone-layer",
                            title: "Ozone Layer",
                        },
                    ],
                },
                {
                    name: "Water",
                    slug: "water",
                    entries: [
                        {
                            slug: "clean-water-sanitation",
                            title: "Clean Water and Sanitation",
                        },
                        {
                            slug: "water-access",
                            title: "Clean Water",
                        },
                        {
                            slug: "sanitation",
                            title: "Sanitation",
                        },
                        {
                            slug: "water-use-stress",
                            title: "Water Use and Stress",
                        },
                    ],
                },
                {
                    name: "Land and Ecosystems",
                    slug: "land-and-ecosystems",
                    entries: [
                        {
                            slug: "biodiversity",
                            title: "Biodiversity",
                        },
                        {
                            slug: "environmental-impacts-of-food",
                            title: "Environmental Impacts of Food Production",
                        },
                        {
                            slug: "forests-and-deforestation",
                            title: "Forests and Deforestation",
                        },
                        {
                            slug: "land-use",
                            title: "Land Use",
                        },
                        {
                            slug: "natural-disasters",
                            title: "Natural Disasters",
                        },
                    ],
                },
            ],
        },
        {
            name: "Food and Agriculture",
            slug: "food",
            entries: [
                {
                    slug: "animal-welfare",
                    title: "Animal Welfare",
                },
            ],
            subcategories: [
                {
                    name: "Nutrition",
                    slug: "nutrition",
                    entries: [
                        {
                            slug: "hunger-and-undernourishment",
                            title: "Hunger and Undernourishment",
                        },
                        {
                            slug: "famines",
                            title: "Famines",
                        },
                        {
                            slug: "food-supply",
                            title: "Food Supply",
                        },
                        {
                            slug: "human-height",
                            title: "Human Height",
                        },
                        {
                            slug: "micronutrient-deficiency",
                            title: "Micronutrient Deficiency",
                        },
                        {
                            slug: "diet-compositions",
                            title: "Diet Compositions",
                        },
                        {
                            slug: "food-prices",
                            title: "Food Prices",
                        },
                        {
                            slug: "obesity",
                            title: "Obesity",
                        },
                        {
                            slug: "alcohol-consumption",
                            title: "Alcohol Consumption",
                        },
                    ],
                },
                {
                    name: "Food Production",
                    slug: "food-production",
                    entries: [
                        {
                            slug: "farm-size",
                            title: "Farm Size and Productivity",
                        },
                        {
                            slug: "agricultural-production",
                            title: "Agricultural Production",
                        },
                        {
                            slug: "environmental-impacts-of-food",
                            title: "Environmental Impacts of Food Production",
                        },
                        {
                            slug: "crop-yields",
                            title: "Crop Yields",
                        },
                        {
                            slug: "meat-production",
                            title: "Meat and Dairy Production",
                        },
                    ],
                },
                {
                    name: "Agricultural Inputs",
                    slug: "agricultural-inputs",
                    entries: [
                        {
                            slug: "employment-in-agriculture",
                            title: "Employment in Agriculture",
                        },
                        {
                            slug: "land-use",
                            title: "Land Use",
                        },
                        {
                            slug: "fertilizers",
                            title: "Fertilizers",
                        },
                        {
                            slug: "pesticides",
                            title: "Pesticides",
                        },
                    ],
                },
            ],
        },
        {
            name: "Poverty and Economic Development",
            slug: "growth-inequality",
            entries: [],
            subcategories: [
                {
                    name: "Public Sector",
                    slug: "public-sector",
                    entries: [
                        {
                            slug: "government-spending",
                            title: "Government Spending",
                        },
                        {
                            slug: "taxation",
                            title: "Taxation",
                        },
                        {
                            slug: "military-personnel-spending",
                            title: "Military Personnel and Spending",
                        },
                        {
                            slug: "financing-healthcare",
                            title: "Healthcare Spending",
                        },
                        {
                            slug: "financing-education",
                            title: "Education Spending",
                        },
                    ],
                },
                {
                    name: "Poverty and Prosperity",
                    slug: "poverty-and-prosperity",
                    entries: [
                        {
                            slug: "economic-inequality",
                            title: "Economic Inequality",
                        },
                        {
                            slug: "poverty",
                            title: "Poverty",
                        },
                        {
                            slug: "economic-growth",
                            title: "Economic Growth",
                        },
                    ],
                },
                {
                    name: "Economic Inequality",
                    slug: "economic-inequality",
                    entries: [
                        {
                            slug: "economic-inequality-by-gender",
                            title: "Economic Inequality by Gender",
                        },
                    ],
                },
                {
                    name: "Labor",
                    slug: "labor",
                    entries: [
                        {
                            slug: "child-labor",
                            title: "Child Labor",
                        },
                        {
                            slug: "working-hours",
                            title: "Working Hours",
                        },
                        {
                            slug: "female-labor-supply",
                            title: "Women’s Employment",
                        },
                    ],
                },
                {
                    name: "Corruption",
                    slug: "corruption",
                    entries: [
                        {
                            slug: "corruption",
                            title: "Corruption",
                        },
                    ],
                },
                {
                    name: "Trade and Migration",
                    slug: "trade-migration",
                    entries: [
                        {
                            slug: "migration",
                            title: "Migration",
                        },
                        {
                            slug: "trade-and-globalization",
                            title: "Trade and Globalization",
                        },
                        {
                            slug: "tourism",
                            title: "Tourism",
                        },
                    ],
                },
            ],
        },
        {
            name: "Education and Knowledge",
            slug: "education",
            entries: [],
            subcategories: [
                {
                    name: "Educational Access and Outcomes",
                    slug: "educational-outcomes",
                    entries: [
                        {
                            slug: "global-education",
                            title: "Global Education",
                        },
                        {
                            slug: "literacy",
                            title: "Literacy",
                        },
                        {
                            slug: "research-and-development",
                            title: "Research and Development",
                        },
                    ],
                },
                {
                    name: "Inputs to Education",
                    slug: "inputs-to-education",
                    entries: [
                        {
                            slug: "financing-education",
                            title: "Education Spending",
                        },
                    ],
                },
                {
                    name: "Media",
                    slug: "media-education",
                    entries: [
                        {
                            slug: "books",
                            title: "Books",
                        },
                        {
                            slug: "internet",
                            title: "Internet",
                        },
                    ],
                },
            ],
        },
        {
            name: "Innovation and Technological Change",
            slug: "technology",
            entries: [],
            subcategories: [
                {
                    name: "Technological Change",
                    slug: "technological-change",
                    entries: [
                        {
                            slug: "artificial-intelligence",
                            title: "Artificial Intelligence",
                        },
                        {
                            slug: "space-exploration-satellites",
                            title: "Space Exploration and Satellites",
                        },
                        {
                            slug: "transport",
                            title: "Transport",
                        },
                        {
                            slug: "internet",
                            title: "Internet",
                        },
                        {
                            slug: "research-and-development",
                            title: "Research and Development",
                        },
                        {
                            slug: "technological-change",
                            title: "Technological Change",
                        },
                    ],
                },
            ],
        },
        {
            name: "Living Conditions, Community and Wellbeing",
            slug: "work-life",
            entries: [],
            subcategories: [
                {
                    name: "Culture",
                    slug: "culture",
                    entries: [
                        {
                            slug: "trust",
                            title: "Trust",
                        },
                    ],
                },
                {
                    name: "Housing",
                    slug: "housing",
                    entries: [
                        {
                            slug: "clean-water-sanitation",
                            title: "Clean Water and Sanitation",
                        },
                        {
                            slug: "energy-access",
                            title: "Access to Energy",
                        },
                        {
                            slug: "water-access",
                            title: "Clean Water",
                        },
                        {
                            slug: "homelessness",
                            title: "Homelessness",
                        },
                        {
                            slug: "indoor-air-pollution",
                            title: "Indoor Air Pollution",
                        },
                        {
                            slug: "light-at-night",
                            title: "Light at Night",
                        },
                        {
                            slug: "sanitation",
                            title: "Sanitation",
                        },
                    ],
                },
                {
                    name: "Time Use",
                    slug: "time-use",
                    entries: [
                        {
                            slug: "time-use",
                            title: "Time Use",
                        },
                        {
                            slug: "working-hours",
                            title: "Working Hours",
                        },
                        {
                            slug: "tourism",
                            title: "Tourism",
                        },
                    ],
                },
                {
                    name: "Relationships",
                    slug: "relationships",
                    entries: [
                        {
                            slug: "marriages-and-divorces",
                            title: "Marriages and Divorces",
                        },
                        {
                            slug: "social-connections-and-loneliness",
                            title: "Loneliness and Social Connections",
                        },
                    ],
                },
                {
                    name: "Happiness and Wellbeing",
                    slug: "happiness-wellbeing",
                    entries: [
                        {
                            slug: "happiness-and-life-satisfaction",
                            title: "Happiness and Life Satisfaction",
                        },
                        {
                            slug: "human-development-index",
                            title: "Human Development Index (HDI)",
                        },
                    ],
                },
            ],
        },
        {
            name: "Human Rights and Democracy",
            slug: "politics",
            entries: [],
            subcategories: [
                {
                    name: "Human Rights",
                    slug: "human-rights",
                    entries: [
                        {
                            slug: "state-capacity",
                            title: "State Capacity",
                        },
                        {
                            slug: "lgbt-rights",
                            title: "LGBT+ Rights",
                        },
                        {
                            slug: "women-rights",
                            title: "Women’s Rights",
                        },
                        {
                            slug: "child-labor",
                            title: "Child Labor",
                        },
                        {
                            slug: "human-rights",
                            title: "Human Rights",
                        },
                    ],
                },
                {
                    name: "Democracy and Corruption",
                    slug: "democracy",
                    entries: [
                        {
                            slug: "democracy",
                            title: "Democracy",
                        },
                        {
                            slug: "corruption",
                            title: "Corruption",
                        },
                    ],
                },
            ],
        },
        {
            name: "Violence and War",
            slug: "violence-rights",
            entries: [],
            subcategories: [
                {
                    name: "War and Peace",
                    slug: "war-peace",
                    entries: [
                        {
                            slug: "biological-and-chemical-weapons",
                            title: "Biological and Chemical Weapons",
                        },
                        {
                            slug: "war-and-peace",
                            title: "War and Peace",
                        },
                        {
                            slug: "military-personnel-spending",
                            title: "Military Personnel and Spending",
                        },
                        {
                            slug: "terrorism",
                            title: "Terrorism",
                        },
                        {
                            slug: "nuclear-weapons",
                            title: "Nuclear Weapons",
                        },
                    ],
                },
                {
                    name: "Violence",
                    slug: "violence",
                    entries: [
                        {
                            slug: "state-capacity",
                            title: "State Capacity",
                        },
                        {
                            slug: "violence-against-rights-for-children",
                            title: "Violence Against Children and Children’s Rights",
                        },
                        {
                            slug: "homicides",
                            title: "Homicides",
                        },
                    ],
                },
            ],
        },
    ],
}
