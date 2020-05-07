import React from "react"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { Flipper, Flipped } from "react-flip-toolkit"
import { bind } from "decko"
import classnames from "classnames"
import { ScaleLinear } from "d3-scale"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"

import { FuzzySearch } from "charts/FuzzySearch"
import { partition, sortBy } from "charts/Util"
import { CovidChartBuilder } from "./CovidChartBuilder"
import { CountryOptionWithSelection } from "./CovidTypes"
import { VerticalScrollContainer } from "charts/VerticalScrollContainer"
import { getLatestTotalTestsPerCase } from "./CovidData"

@observer
export class CountryPicker extends React.Component<{
    chartBuilder: CovidChartBuilder
    toggleCountryCommand: (countryCode: string, value: boolean) => void
}> {
    @action.bound private onChange(code: string, checked: boolean) {
        this.props.toggleCountryCommand(code, checked)
    }

    @computed private get fuzzy(): FuzzySearch<CountryOptionWithSelection> {
        return new FuzzySearch(this.options, "name")
    }

    @computed private get searchResults(): CountryOptionWithSelection[] {
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

    @computed private get selectedCountries(): CountryOptionWithSelection[] {
        return this.options.filter(country => country.selected)
    }

    @computed private get options() {
        return this.props.chartBuilder.countryOptionsWithSelectionStatus
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
                        renderCountry={props => (
                            <CovidCountryOption
                                barScale={this.props.chartBuilder.barScale}
                                {...props}
                            />
                        )}
                    />
                    <div className="CountrySelectionControls">
                        <div
                            className="ClearSelectionButton"
                            onClick={
                                this.props.chartBuilder.clearSelectionCommand
                            }
                        >
                            <FontAwesomeIcon icon={faTimes} /> Clear selection
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
                    type="search"
                    placeholder="Search for a country..."
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
    countries: CountryOptionWithSelection[]
    selectedCountries: CountryOptionWithSelection[]
    onChange: (code: string, checked: boolean) => void
    renderCountry: (props: CovidCountryOptionProps) => JSX.Element
}

class CovidCountryResults extends React.Component<CovidCountryResultsProps> {
    render() {
        const { countries, selectedCountries, onChange } = this.props
        return (
            <VerticalScrollContainer
                scrollingShadows={true}
                scrollLock={true}
                className="CountrySearchResults"
                contentsId={countries.map(c => c.name).join(",")}
            >
                <Flipper
                    spring={{
                        stiffness: 300,
                        damping: 33
                    }}
                    // We only want to animate when the selection changes, but not on changes due to
                    // searching
                    flipKey={selectedCountries.map(s => s.name).join(",")}
                >
                    {countries.map((option, index) => (
                        <React.Fragment key={index}>
                            {this.props.renderCountry({ option, onChange })}
                        </React.Fragment>
                    ))}
                </Flipper>
            </VerticalScrollContainer>
        )
    }
}

interface CovidCountryOptionProps {
    option: CountryOptionWithSelection
    onChange: (code: string, checked: boolean) => void
    barScale?: ScaleLinear<number, number>
}

class CovidCountryOption extends React.Component<CovidCountryOptionProps> {
    render() {
        const { option, onChange, barScale } = this.props
        const testsPerCase = option.latestTotalTestsPerCase
        return (
            <Flipped flipId={option.name} translate opacity>
                <label
                    className={classnames("CountryOption", {
                        selected: option.selected
                    })}
                >
                    <div className="input-container">
                        <input
                            type="checkbox"
                            checked={option.selected}
                            onChange={event =>
                                onChange(
                                    option.code,
                                    event.currentTarget.checked
                                )
                            }
                            value={option.code}
                        />
                    </div>
                    <div className="info-container">
                        <div className="labels-container">
                            <div className="name">{option.name}</div>
                            {/* Hide testing numbers as they lack labels to be understandable */}
                            {/* {testsPerCase && (
                                <div className="metric">
                                    {testsPerCase.toFixed(1)}
                                </div>
                            )} */}
                        </div>
                        {/* Hide plot as it lacks labels to be understandable */}
                        {/* {barScale && testsPerCase ? (
                            <div className="plot">
                                <div
                                    className="bar"
                                    style={{
                                        width: `${barScale(testsPerCase) *
                                            100}%`
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="plot"></div>
                        )} */}
                    </div>
                </label>
            </Flipped>
        )
    }
}
