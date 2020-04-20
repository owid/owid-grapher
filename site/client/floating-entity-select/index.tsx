import * as React from "react"
import * as ReactDOM from "react-dom"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import Select, { ValueType, components, OptionProps } from "react-select"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"

import { countries, Country } from "utils/countries"
import { isMultiSelect, sortBy } from "charts/Util"

const Option = (props: OptionProps<Country>) => {
    return (
        <div>
            <components.Option {...props}>
                <input type="checkbox" checked={props.isSelected} readOnly />{" "}
                <label>{props.label}</label>
            </components.Option>
        </div>
    )
}

@observer
class Control extends React.Component {
    // Set some defaults temporarily
    @observable private selectedCountries: Country[] = countries.filter(
        c => c.code === "GBR" || c.code === "MKD"
    )

    @computed private get allCountries(): Country[] {
        return sortBy(countries, country => country.name)
    }

    private getOptionValue(country: Country) {
        return country.code
    }

    private getOptionLabel(country: Country) {
        return country.name
    }

    @action.bound private onChange(countries: ValueType<Country>) {
        if (countries == null) return
        if (!isMultiSelect(countries)) {
            countries = [countries]
        }
        this.selectedCountries = Array.from(countries)
    }

    @action.bound private onRemove(countryToRemove: Country) {
        this.selectedCountries = this.selectedCountries.filter(
            country => country !== countryToRemove
        )
    }

    render() {
        return (
            <div className="floating-entity-control">
                <div className="select-dropdown-container">
                    <Select
                        options={this.allCountries}
                        getOptionValue={this.getOptionValue}
                        getOptionLabel={this.getOptionLabel}
                        onChange={this.onChange}
                        value={this.selectedCountries}
                        components={{
                            IndicatorSeparator: null,
                            Option
                        }}
                        menuPlacement="bottom"
                        isClearable={false}
                        isMulti={true}
                        backspaceRemovesValue={false}
                        blurInputOnSelect={false}
                        closeMenuOnSelect={false}
                        controlShouldRenderValue={false}
                        hideSelectedOptions={false}
                        placeholder="Add a country to all charts..."
                    />
                </div>
                <div className="selected-items-container">
                    <div className="selected-items">
                        {this.selectedCountries.map(country => (
                            <div className="selected-item">
                                <div className="label">{country.name}</div>
                                <div
                                    className="control-icon"
                                    onClick={() => this.onRemove(country)}
                                >
                                    <FontAwesomeIcon icon={faTimes} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }
}

export function runFloatingEntitySelect() {
    const element = document.querySelector("*[data-floating-entity-control]")
    if (element) {
        element.classList.add("floating-entity-control-container")
        ReactDOM.render(<Control />, element)
    }
}
