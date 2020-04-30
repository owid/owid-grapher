import React from "react"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { Flipper, Flipped } from "react-flip-toolkit"
import { bind } from "decko"
import classnames from "classnames"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"

import { FuzzySearch } from "charts/FuzzySearch"
import { partition, sortBy } from "charts/Util"
import { CovidChartBuilder } from "./CovidChartBuilder"
import { CountryOption } from "./CovidTypes"

@observer
export class CountryPicker extends React.Component<{
    chartBuilder: CovidChartBuilder
    toggleCountryCommand: (countryCode: string, value: boolean) => void
}> {
    @action.bound private onChange(ev: React.FormEvent<HTMLInputElement>) {
        this.props.toggleCountryCommand(
            ev.currentTarget.value,
            ev.currentTarget.checked
        )
    }

    @computed private get fuzzy(): FuzzySearch<CountryOption> {
        return new FuzzySearch(this.options, "name")
    }

    @computed private get searchResults(): CountryOption[] {
        const results = this.searchInput
            ? this.fuzzy.search(this.searchInput)
            : this.options
        // Show the selected up top and in order.
        const [selected, unselected] = partition(
            sortBy(results, r => r.name),
            result => result.selected
        )
        return [...selected, ...unselected]
    }

    @computed private get selectedCountries(): CountryOption[] {
        return this.options.filter(country => country.selected)
    }

    @computed private get options() {
        return this.props.chartBuilder.countryOptions
    }

    @observable private searchInput?: string

    render() {
        return (
            <div className="CountryPicker">
                <CovidSearchInput
                    value={this.searchInput}
                    onInput={query => (this.searchInput = query)}
                />
                <div className="CountryList">
                    <CovidCountryResults
                        countries={this.searchResults}
                        selectedCountries={this.selectedCountries}
                        onChange={this.onChange}
                    />
                    <div className="CountrySelectionControls">
                        <div
                            className="ClearSelectionButton"
                            onClick={
                                this.props.chartBuilder.clearSelectionCommand
                            }
                        >
                            <strong>X</strong> Clear selection
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

interface CovidSearchInputProps {
    value: string | undefined
    onInput: (value: string) => void
}

class CovidSearchInput extends React.Component<CovidSearchInputProps> {
    @bind onInput(event: React.FormEvent<HTMLInputElement>) {
        this.props.onInput(event.currentTarget.value)
    }

    render() {
        return (
            <div className="CovidSearchInput">
                <input
                    className="input-field"
                    type="text"
                    placeholder="Add a country"
                    value={this.props.value}
                    onInput={this.onInput}
                />
                <div className="search-icon">
                    <FontAwesomeIcon icon={faSearch} />
                </div>
            </div>
        )
    }
}

interface CovidCountryResultsProps {
    countries: CountryOption[]
    selectedCountries: CountryOption[]
    onChange: (ev: React.FormEvent<HTMLInputElement>) => void
}

class CovidCountryResults extends React.Component<CovidCountryResultsProps> {
    render() {
        const { countries, selectedCountries } = this.props
        return (
            <div className="CountrySearchResults">
                <Flipper
                    spring={{
                        stiffness: 300,
                        damping: 33
                    }}
                    flipKey={selectedCountries.map(s => s.name).join(",")}
                >
                    {countries.map((option, index) => (
                        <Flipped flipId={option.name} translate opacity>
                            <label
                                className={classnames("CountryOption", {
                                    MissingTests: !option.totalTests,
                                    selected: option.selected
                                })}
                                key={index}
                                title={
                                    option.totalTests
                                        ? `${option.totalTests}`
                                        : "No testing data available."
                                }
                            >
                                <input
                                    type="checkbox"
                                    checked={option.selected}
                                    onChange={this.props.onChange}
                                    value={option.code}
                                />
                                {option.name}{" "}
                            </label>
                        </Flipped>
                    ))}
                </Flipper>
            </div>
        )
    }
}
