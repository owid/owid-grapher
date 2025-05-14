import { faClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Region } from "@ourworldindata/utils"

export const SelectedCountriesPills = ({
    selectedCountries,
    removeCountry,
}: {
    selectedCountries: Region[]
    removeCountry: (country: string) => void
}) => {
    return (
        <div className="data-catalog-selected-countries-container">
            {selectedCountries.map((country) => (
                <div
                    key={country.code}
                    className="data-catalog-selected-country-pill"
                >
                    <img
                        width={20}
                        height={16}
                        src={`/images/flags/${country.code}.svg`}
                    />
                    <span className="body-3-medium">{country.name}</span>
                    <button
                        aria-label={`Remove ${country.name}`}
                        onClick={() => {
                            removeCountry(country.name)
                        }}
                    >
                        <FontAwesomeIcon icon={faClose} />
                    </button>
                </div>
            ))}
        </div>
    )
}
