import { faClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Region } from "@ourworldindata/utils"
import cx from "classnames"
import { CountryPill } from "./CountryPill"

export const SelectedCountriesPills = ({
    selectedCountries,
    removeCountry,
}: {
    selectedCountries: Region[]
    removeCountry: (country: string) => void
}) => {
    const countryNameWidth = selectedCountries.reduce(
        (total, cur) => total + cur.name.length,
        0
    )
    // A rough heuristic to determine if we should consolidate the selected countries into a single button on desktop
    // We always show the consolidated button on mobile
    const shouldMinifyOnDesktop = countryNameWidth > 30
    const minifiedButton = selectedCountries.length ? (
        <div
            className={cx(
                "data-catalog-selected-country-pill data-catalog-selected-country-pill__mini",
                {
                    "data-catalog-selected-country-pill__mini--show-on-desktop":
                        shouldMinifyOnDesktop,
                }
            )}
        >
            <img
                width={20}
                height={16}
                src={`/images/flags/${selectedCountries[0].code}.svg`}
            />
            {selectedCountries.length - 1 ? (
                <span>+ {selectedCountries.length - 1} more</span>
            ) : null}
            <button
                aria-label="Remove all country filters"
                onClick={() => {
                    selectedCountries.forEach((country) => {
                        removeCountry(country.name)
                    })
                }}
            >
                <FontAwesomeIcon icon={faClose} />
            </button>
        </div>
    ) : null

    return (
        <div className="data-catalog-selected-countries-container">
            {selectedCountries.map((country) => (
                <CountryPill
                    key={country.code}
                    name={country.name}
                    code={country.code}
                    onRemove={removeCountry}
                    hideOnDesktop={shouldMinifyOnDesktop}
                />
            ))}
            {minifiedButton}
        </div>
    )
}
