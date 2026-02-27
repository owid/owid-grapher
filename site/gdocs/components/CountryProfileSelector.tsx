import { useState, useMemo, ReactNode } from "react"
import { EnrichedBlockCountryProfileSelector } from "@ourworldindata/types"
import {
    getRegionByCode,
    getRegionByNameOrVariantName,
} from "@ourworldindata/utils"
import { useLinkedDocument } from "../utils.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faArrowRight,
    faMagnifyingGlass,
    faTimesCircle,
} from "@fortawesome/free-solid-svg-icons"
import { IS_ARCHIVE } from "../../../settings/clientSettings.js"
import { PROD_URL } from "../../SiteConstants.js"
import urlJoin from "url-join"

interface CountryItem {
    name: string
    code: string
    slug: string
}

const FALLBACK_DEFAULT_COUNTRY_NAMES = [
    "United Kingdom",
    "United States",
    "China",
    "Nigeria",
    "India",
    "Brazil",
]

function resolveCountriesToItems(entityCodes: string[]): CountryItem[] {
    return entityCodes
        .map((code) => {
            const region = getRegionByCode(code)
            if (!region) return undefined
            return {
                name: region.name,
                code: region.code,
                slug: region.slug,
            }
        })
        .filter((item): item is CountryItem => !!item)
        .sort((a, b) => a.name.localeCompare(b.name))
}

function resolveDefaultCountries(
    defaultCountryNames: string[],
    allCountries: CountryItem[]
): CountryItem[] {
    const allByCode = new Map(allCountries.map((c) => [c.code, c]))
    return defaultCountryNames
        .map((name) => {
            const region = getRegionByNameOrVariantName(name)
            if (!region) return undefined
            return allByCode.get(region.code)
        })
        .filter((item): item is CountryItem => !!item)
}

export function CountryProfileSelector({
    block,
    className,
}: {
    block: EnrichedBlockCountryProfileSelector
    className?: string
}) {
    const { linkedDocument, errorMessage } = useLinkedDocument(block.url)
    const [searchTerm, setSearchTerm] = useState("")

    const allCountries = useMemo(() => {
        if (!linkedDocument?.availableEntityCodes) return []
        return resolveCountriesToItems(linkedDocument.availableEntityCodes)
    }, [linkedDocument?.availableEntityCodes])

    const defaultCountries = useMemo(() => {
        const names = block.defaultCountries.length
            ? block.defaultCountries
            : FALLBACK_DEFAULT_COUNTRY_NAMES
        return resolveDefaultCountries(names, allCountries)
    }, [block.defaultCountries, allCountries])

    const filteredCountries = useMemo(() => {
        if (!searchTerm.trim()) return defaultCountries
        const term = searchTerm.toLowerCase()
        return allCountries
            .filter((c) => c.name.toLowerCase().includes(term))
            .slice(0, 6)
    }, [searchTerm, allCountries, defaultCountries])

    if (errorMessage) {
        return (
            <div className={className}>
                <p className="country-profile-selector__error">
                    {errorMessage}
                </p>
            </div>
        )
    }

    if (!linkedDocument) return null

    const profileBaseUrl = urlJoin(
        // We currently don't archive topic pages or profiles, so this component shouldn't appear in an archive
        // but if it does (in an article, for some reason) we want to make sure the links point to the live site, not the archive.
        IS_ARCHIVE ? PROD_URL : "/",
        "profile",
        linkedDocument.slug
    )
    const title = block.title ?? "Country profiles"
    const description =
        block.description ??
        "Explore key metrics on energy consumption and sources of energy in your country, and more than 200 other countries."

    return (
        <div className={className}>
            <div className="country-profile-selector grid grid-cols-12 col-start-2 span-cols-12">
                <div className="country-profile-selector__info span-cols-5 span-sm-cols-12">
                    <h2 className="country-profile-selector__title h1-semibold">
                        {title}
                    </h2>
                    <p className="country-profile-selector__description body-2-regular">
                        {description}
                    </p>
                </div>
                <div className="country-profile-selector__panel col-start-8 span-cols-4 col-md-start-7 span-md-cols-6 span-sm-cols-12">
                    <div className="country-profile-selector__search-wrapper">
                        <FontAwesomeIcon
                            icon={faMagnifyingGlass}
                            className="country-profile-selector__search-icon"
                        />

                        <input
                            type="text"
                            className="country-profile-selector__search"
                            placeholder="Search for a country..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                className="country-profile-selector__clear-button"
                                aria-label="Clear search"
                                onClick={() => setSearchTerm("")}
                            >
                                <FontAwesomeIcon icon={faTimesCircle} />
                            </button>
                        )}
                    </div>
                    <div className="country-profile-selector__grid">
                        {filteredCountries.length > 0 ? (
                            filteredCountries.map((country) => (
                                <CountryProfileLink
                                    key={country.code}
                                    country={country}
                                    profileBaseUrl={profileBaseUrl}
                                    searchTerm={searchTerm}
                                />
                            ))
                        ) : searchTerm.trim() ? (
                            <NoResults searchTerm={searchTerm} />
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    )
}

function highlightMatch(text: string, searchTerm: string): ReactNode {
    if (!searchTerm.trim()) return text
    const regex = new RegExp(
        `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi"
    )
    const parts = text.split(regex)
    if (parts.length === 1) return text
    return parts.map((part, i) =>
        regex.test(part) ? <strong key={i}>{part}</strong> : part
    )
}

function CountryProfileLink({
    country,
    profileBaseUrl,
    searchTerm,
}: {
    country: CountryItem
    profileBaseUrl: string
    searchTerm: string
}) {
    return (
        <a
            href={`${profileBaseUrl}/${country.slug}`}
            className="country-profile-selector__country"
        >
            <img
                className="country-profile-selector__flag"
                src={`/images/flags/${country.code}.svg`}
                alt=""
                loading="lazy"
            />
            <span className="country-profile-selector__country-name body-3-medium">
                {highlightMatch(country.name, searchTerm)}
                <FontAwesomeIcon
                    className="country-profile-selector__arrow"
                    icon={faArrowRight}
                />
            </span>
        </a>
    )
}

function NoResults({ searchTerm }: { searchTerm: string }) {
    return (
        <p className="country-profile-selector__no-results body-3-medium">
            No country profiles found for &ldquo;{searchTerm}&rdquo;
        </p>
    )
}
