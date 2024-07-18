import React, { useCallback, useEffect } from "react"
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
import {
    CategoryWithEntries,
    OwidGdocType,
    getOwidGdocFromJSON,
} from "@ourworldindata/utils"
import { SiteResources } from "./SiteResources.js"
import { SiteSearchNavigation } from "./SiteSearchNavigation.js"
import { SiteMobileMenu } from "./SiteMobileMenu.js"
import { SiteNavigationToggle } from "./SiteNavigationToggle.js"
import classnames from "classnames"
import { useTriggerOnEscape } from "./hooks.js"
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
    isOnHomepage,
}: {
    baseUrl: string
    hideDonationFlag?: boolean
    isOnHomepage?: boolean
}) => {
    const [menu, setActiveMenu] = React.useState<Menu | null>(null)
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
            // Only run when screen size is large, .aa-DetachedContainer gets positioned correctly
            if (window.innerWidth < 768) return
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
                            ariaLabel="Toggle menu"
                            isActive={isActiveMobileMenu}
                            onToggle={() => toggleMenu(Menu.Topics)}
                            className="SiteNavigationToggle--mobile-menu hide-sm-up"
                            dropdown={
                                <SiteMobileMenu
                                    menu={menu}
                                    toggleMenu={toggleMenu}
                                    topics={SiteNavigationStatic.categories}
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
                                        ariaLabel="Toggle topics menu"
                                        isActive={menu === Menu.Topics}
                                        onToggle={() => toggleMenu(Menu.Topics)}
                                        dropdown={
                                            <SiteNavigationTopics
                                                onClose={closeOverlay}
                                                topics={
                                                    SiteNavigationStatic.categories
                                                }
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
                                <li>
                                    <a href="/about">About</a>
                                </li>
                            </ul>
                        </nav>
                        <div className="site-search-cta">
                            {!isOnHomepage && (
                                <SiteSearchNavigation
                                    isActive={menu === Menu.Search}
                                    onClose={closeOverlay}
                                    onActivate={setSearchAsActiveMenu}
                                />
                            )}
                            <SiteNavigationToggle
                                ariaLabel="Toggle subscribe menu"
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
                    name: "Births and Deaths",
                    slug: "births-and-deaths",
                    entries: [
                        {
                            slug: "life-expectancy",
                            title: "Life Expectancy",
                        },
                        {
                            slug: "fertility-rate",
                            title: "Fertility Rate",
                        },
                        {
                            slug: "child-mortality",
                            title: "Child and Infant Mortality",
                        },
                    ],
                },
                {
                    name: "Geography of the World Population",
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
            entries: [],
            subcategories: [
                {
                    name: "Life and Death",
                    slug: "life-and-death",
                    entries: [
                        {
                            slug: "health-meta",
                            title: "Global Health",
                        },
                        {
                            slug: "causes-of-death",
                            title: "Causes of Death",
                        },
                        {
                            slug: "child-mortality",
                            title: "Child and Infant Mortality",
                        },
                        {
                            slug: "burden-of-disease",
                            title: "Burden of Disease",
                        },
                        {
                            slug: "life-expectancy",
                            title: "Life Expectancy",
                        },
                        {
                            slug: "mental-health",
                            title: "Mental Health",
                        },
                        {
                            slug: "suicide",
                            title: "Suicides",
                        },
                        {
                            slug: "cardiovascular-diseases",
                            title: "Cardiovascular Diseases",
                        },
                        {
                            slug: "cancer",
                            title: "Cancer",
                        },
                        {
                            slug: "maternal-mortality",
                            title: "Maternal Mortality",
                        },
                    ],
                },
                {
                    name: "Health Risks",
                    slug: "health-risks",
                    entries: [
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
                            slug: "lead-pollution",
                            title: "Lead Pollution",
                        },
                        {
                            slug: "alcohol-consumption",
                            title: "Alcohol Consumption",
                        },
                        {
                            slug: "illicit-drug-use",
                            title: "Opioids, Cocaine, Cannabis, and Other Illicit Drugs",
                        },

                        {
                            slug: "obesity",
                            title: "Obesity",
                        },
                        {
                            slug: "smoking",
                            title: "Smoking",
                        },
                    ],
                },
                {
                    name: "Infectious Diseases",
                    slug: "infectious-diseases",
                    entries: [
                        {
                            slug: "pandemics",
                            title: "Pandemics",
                        },
                        {
                            slug: "coronavirus",
                            title: "Coronavirus Pandemic (COVID-19)",
                        },
                        {
                            slug: "malaria",
                            title: "Malaria",
                        },
                        {
                            slug: "hiv-aids",
                            title: "HIV/AIDS",
                        },
                        {
                            slug: "diarrheal-diseases",
                            title: "Diarrheal Diseases",
                        },
                        {
                            slug: "tuberculosis",
                            title: "Tuberculosis",
                        },
                        {
                            slug: "polio",
                            title: "Polio",
                        },
                        {
                            slug: "neglected-tropical-diseases",
                            title: "Neglected Tropical Diseases",
                        },
                        {
                            slug: "influenza",
                            title: "Influenza",
                        },
                        {
                            slug: "pneumonia",
                            title: "Pneumonia",
                        },
                        {
                            slug: "tetanus",
                            title: "Tetanus",
                        },
                        {
                            slug: "monkeypox",
                            title: "Mpox",
                        },
                        {
                            slug: "smallpox",
                            title: "Smallpox",
                        },
                    ],
                },
                {
                    name: "Health Institutions and Interventions",
                    slug: "health-institutions-and-interventions",
                    entries: [
                        {
                            slug: "eradication-of-diseases",
                            title: "Eradication of Diseases",
                        },
                        {
                            slug: "vaccination",
                            title: "Vaccination",
                        },
                        {
                            slug: "financing-healthcare",
                            title: "Healthcare Spending",
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
                    name: "Climate and Air",
                    slug: "climate-and-air",
                    entries: [
                        {
                            slug: "climate-change",
                            title: "Climate Change",
                        },
                        {
                            slug: "co2-and-greenhouse-gas-emissions",
                            title: "CO₂ and Greenhouse Gas Emissions",
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
                    name: "Energy Systems",
                    slug: "energy-systems",
                    entries: [
                        {
                            slug: "energy",
                            title: "Energy",
                        },
                        {
                            slug: "energy-access",
                            title: "Access to Energy",
                        },
                        {
                            slug: "fossil-fuels",
                            title: "Fossil Fuels",
                        },
                        {
                            slug: "renewable-energy",
                            title: "Renewable Energy",
                        },

                        {
                            slug: "nuclear-energy",
                            title: "Nuclear Energy",
                        },
                    ],
                },
                {
                    name: "Environment and Ecosystems",
                    slug: "land-and-ecosystems",
                    entries: [
                        {
                            slug: "natural-disasters",
                            title: "Natural Disasters",
                        },
                        {
                            slug: "biodiversity",
                            title: "Biodiversity",
                        },
                        {
                            slug: "environmental-impacts-of-food",
                            title: "Environmental Impacts of Food Production",
                        },
                        {
                            slug: "fish-and-overfishing",
                            title: "Fish and Overfishing",
                        },
                        {
                            slug: "land-use",
                            title: "Land Use",
                        },
                        {
                            slug: "water-use-stress",
                            title: "Water Use and Stress",
                        },
                        {
                            slug: "forests-and-deforestation",
                            title: "Forests and Deforestation",
                        },
                        {
                            slug: "wildfires",
                            title: "Wildfires",
                        },
                        {
                            slug: "animal-welfare",
                            title: "Animal Welfare",
                        },
                    ],
                },
                {
                    name: "Waste and Pollution",
                    slug: "waste-and-pollution",
                    entries: [
                        {
                            slug: "plastic-pollution",
                            title: "Plastic Pollution",
                        },
                        {
                            slug: "oil-spills",
                            title: "Oil Spills",
                        },
                        {
                            slug: "lead-pollution",
                            title: "Lead Pollution",
                        },
                    ],
                },
            ],
        },
        {
            name: "Food and Agriculture",
            slug: "food",
            entries: [],
            subcategories: [
                {
                    name: "Food Production",
                    slug: "food-production",
                    entries: [
                        {
                            slug: "agricultural-production",
                            title: "Agricultural Production",
                        },
                        {
                            slug: "meat-production",
                            title: "Meat and Dairy Production",
                        },
                        {
                            slug: "fish-and-overfishing",
                            title: "Fish and Overfishing",
                        },
                        {
                            slug: "crop-yields",
                            title: "Crop Yields",
                        },
                        {
                            slug: "animal-welfare",
                            title: "Animal Welfare",
                        },
                        {
                            slug: "environmental-impacts-of-food",
                            title: "Environmental Impacts of Food Production",
                        },
                        {
                            slug: "farm-size",
                            title: "Farm Size and Productivity",
                        },
                    ],
                },
                {
                    name: "Agricultural Inputs",
                    slug: "agricultural-inputs",
                    entries: [
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
                        {
                            slug: "employment-in-agriculture",
                            title: "Employment in Agriculture",
                        },
                    ],
                },
                {
                    name: "Nutrition",
                    slug: "nutrition",
                    entries: [
                        {
                            slug: "hunger-and-undernourishment",
                            title: "Hunger and Undernourishment",
                        },
                        {
                            slug: "food-supply",
                            title: "Food Supply",
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
                            slug: "famines",
                            title: "Famines",
                        },
                        {
                            slug: "diet-compositions",
                            title: "Diet Compositions",
                        },
                        {
                            slug: "micronutrient-deficiency",
                            title: "Micronutrient Deficiency",
                        },
                        {
                            slug: "human-height",
                            title: "Human Height",
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
                    name: "Poverty and Prosperity",
                    slug: "poverty-and-prosperity",
                    entries: [
                        {
                            slug: "poverty",
                            title: "Poverty",
                        },
                        {
                            slug: "economic-growth",
                            title: "Economic Growth",
                        },
                        {
                            slug: "economic-inequality",
                            title: "Economic Inequality",
                        },
                        {
                            slug: "economic-inequality-by-gender",
                            title: "Economic Inequality by Gender",
                        },
                    ],
                },
                {
                    name: "Public Sector",
                    slug: "public-sector",
                    entries: [
                        {
                            slug: "government-spending",
                            title: "Government Spending",
                        },
                        {
                            slug: "state-capacity",
                            title: "State Capacity",
                        },
                        {
                            slug: "taxation",
                            title: "Taxation",
                        },
                        {
                            slug: "corruption",
                            title: "Corruption",
                        },
                        {
                            slug: "financing-healthcare",
                            title: "Healthcare Spending",
                        },
                        {
                            slug: "financing-education",
                            title: "Education Spending",
                        },
                        {
                            slug: "military-personnel-spending",
                            title: "Military Personnel and Spending",
                        },
                    ],
                },

                {
                    name: "Labor",
                    slug: "labor",
                    entries: [
                        {
                            slug: "female-labor-supply",
                            title: "Women’s Employment",
                        },
                        {
                            slug: "child-labor",
                            title: "Child Labor",
                        },
                        {
                            slug: "working-hours",
                            title: "Working Hours",
                        },
                    ],
                },
                {
                    name: "Global Connections",
                    slug: "trade-migration",
                    entries: [
                        {
                            slug: "trade-and-globalization",
                            title: "Trade and Globalization",
                        },
                        {
                            slug: "migration",
                            title: "Migration",
                        },
                        {
                            slug: "tourism",
                            title: "Tourism",
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
                    name: "Education",
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
                            slug: "financing-education",
                            title: "Education Spending",
                        },
                    ],
                },
                {
                    name: "Knowledge",
                    slug: "inputs-to-education",
                    entries: [
                        {
                            slug: "research-and-development",
                            title: "Research and Development",
                        },
                        {
                            slug: "internet",
                            title: "Internet",
                        },
                        {
                            slug: "books",
                            title: "Books",
                        },
                    ],
                },
            ],
        },
        {
            name: "Innovation and Technological Change",
            slug: "technology",
            entries: [
                {
                    slug: "technological-change",
                    title: "Technological Change",
                },
                {
                    slug: "research-and-development",
                    title: "Research and Development",
                },
                {
                    slug: "artificial-intelligence",
                    title: "Artificial Intelligence",
                },
                {
                    slug: "internet",
                    title: "Internet",
                },
                {
                    slug: "space-exploration-satellites",
                    title: "Space Exploration and Satellites",
                },
                {
                    slug: "transport",
                    title: "Transport",
                },
            ],
            subcategories: [],
        },
        {
            name: "Living Conditions, Community, and Wellbeing",
            slug: "work-life",
            entries: [],
            subcategories: [
                {
                    name: "Housing and Infrastructure",
                    slug: "housing-and-infrastructure",
                    entries: [
                        {
                            slug: "homelessness",
                            title: "Homelessness",
                        },
                        {
                            slug: "energy-access",
                            title: "Access to Energy",
                        },
                        {
                            slug: "indoor-air-pollution",
                            title: "Indoor Air Pollution",
                        },

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
                            slug: "light-at-night",
                            title: "Light at Night",
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
                        {
                            slug: "trust",
                            title: "Trust",
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
            entries: [
                {
                    slug: "human-rights",
                    title: "Human Rights",
                },
                {
                    slug: "democracy",
                    title: "Democracy",
                },
                {
                    slug: "state-capacity",
                    title: "State Capacity",
                },
                {
                    slug: "women-rights",
                    title: "Women’s Rights",
                },
                {
                    slug: "lgbt-rights",
                    title: "LGBT+ Rights",
                },
                {
                    slug: "corruption",
                    title: "Corruption",
                },
                {
                    slug: "economic-inequality-by-gender",
                    title: "Economic Inequality by Gender",
                },
                {
                    slug: "child-labor",
                    title: "Child Labor",
                },
                {
                    slug: "violence-against-rights-for-children",
                    title: "Violence Against Children and Children’s Rights",
                },
            ],
            subcategories: [],
        },
        {
            name: "Violence and War",
            slug: "violence-rights",
            entries: [
                {
                    slug: "war-and-peace",
                    title: "War and Peace",
                },
                {
                    slug: "nuclear-weapons",
                    title: "Nuclear Weapons",
                },
                {
                    slug: "homicides",
                    title: "Homicides",
                },
                {
                    slug: "terrorism",
                    title: "Terrorism",
                },
                {
                    slug: "state-capacity",
                    title: "State Capacity",
                },
                {
                    slug: "military-personnel-spending",
                    title: "Military Personnel and Spending",
                },
                {
                    slug: "biological-and-chemical-weapons",
                    title: "Biological and Chemical Weapons",
                },
                {
                    slug: "violence-against-rights-for-children",
                    title: "Violence Against Children and Children’s Rights",
                },
            ],
            subcategories: [],
        },
    ],
}

export const getUniqueTopicCount = () =>
    SiteNavigationStatic.categories
        .flatMap((category) => {
            const subcategoryEntries =
                category?.subcategories?.flatMap(
                    (subcategory) => subcategory.entries || []
                ) || []
            return [...category.entries, ...subcategoryEntries]
        })
        .map((entry) => entry.slug)
        .filter((value, index, array) => array.indexOf(value) === index).length
