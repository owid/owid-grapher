import { useState, useMemo, ReactNode } from "react"
import { EnrichedBlockCountryProfileSelector } from "@ourworldindata/types"
import {
    FuzzySearch,
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
    searchKeys: string[]
}

interface FilteredCountryItem {
    country: CountryItem
    highlightIndexes?: number[]
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
                searchKeys: [
                    region.name,
                    ...(region.shortName ? [region.shortName] : []),
                    ...("variantNames" in region
                        ? (region.variantNames ?? [])
                        : []),
                ],
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

    const fuzzyCountrySearch = useMemo(
        () =>
            FuzzySearch.withKeyArray(
                allCountries,
                (country) => country.searchKeys,
                (country) => country.code,
                { limit: 6 }
            ),
        [allCountries]
    )

    const filteredCountries = useMemo<FilteredCountryItem[]>(() => {
        const term = searchTerm.trim()
        if (!term) {
            return defaultCountries.map((country) => ({ country }))
        }

        return fuzzyCountrySearch.search(term).map((country) => ({
            country,
            highlightIndexes: fuzzyCountrySearch.single(term, country.name)
                ?.indexes,
        }))
    }, [searchTerm, defaultCountries, fuzzyCountrySearch])

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
    const title = block.title ?? "Country Profiles"
    const description =
        block.description ?? "Browse country-level data and insights."

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
                                    key={country.country.code}
                                    country={country.country}
                                    highlightIndexes={country.highlightIndexes}
                                    profileBaseUrl={profileBaseUrl}
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

/**
 * Takes e.g. "United States" and [0, 7]
 * returns [<strong>U</strong>, "nited ", <strong>S</strong>, "tates"]
 */
function highlightMatch(text: string, highlightIndexes?: number[]): ReactNode {
    if (!highlightIndexes?.length) return text

    const highlighted = new Set(highlightIndexes)
    const parts: ReactNode[] = []
    let start = 0

    while (start < text.length) {
        const isMatch = highlighted.has(start)
        let end = start + 1
        while (end < text.length && highlighted.has(end) === isMatch) {
            end++
        }

        const chunk = text.slice(start, end)
        parts.push(isMatch ? <strong key={start}>{chunk}</strong> : chunk)
        start = end
    }

    return parts
}

function CountryProfileLink({
    country,
    highlightIndexes,
    profileBaseUrl,
}: {
    country: CountryItem
    highlightIndexes?: number[]
    profileBaseUrl: string
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
                {highlightMatch(country.name, highlightIndexes)}
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
