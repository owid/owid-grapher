import * as React from "react"
import * as ReactDOM from "react-dom"
import * as ReactDOMServer from "react-dom/server"
import { computed, action, observable, IReactionDisposer, reaction } from "mobx"
import { observer } from "mobx-react"
import Select, { ValueType, components, OptionProps, Props } from "react-select"
import classnames from "classnames"
import { bind } from "decko"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"

import { countries } from "utils/countries"
import { throttle, noop, orderBy } from "charts/Util"
import {
    GlobalEntitySelection,
    GlobalEntitySelectionEntity
} from "./GlobalEntitySelection"
import { isMultiValue } from "utils/client/react-select"

const Option = (props: OptionProps<GlobalEntitySelectionEntity>) => {
    return (
        <div>
            <components.Option {...props}>
                <input type="checkbox" checked={props.isSelected} readOnly />{" "}
                <label>{props.label}</label>
            </components.Option>
        </div>
    )
}

const EntitySelect = (props: Props<GlobalEntitySelectionEntity>) => {
    return (
        <Select
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
            styles={{
                placeholder: base => ({ ...base, whiteSpace: "nowrap" }),
                valueContainer: base => ({
                    ...base,
                    paddingTop: 0,
                    paddingBottom: 0
                }),
                control: base => ({ ...base, minHeight: "initial" }),
                dropdownIndicator: base => ({ ...base, padding: "0 5px" })
            }}
            {...props}
        />
    )
}

function SelectedItems<T>(props: {
    selectedItems: T[]
    emptyLabel: string
    getLabel: (item: T) => string
    canRemove?: boolean
    onRemove?: (item: T) => void
}) {
    const canRemove = (props.canRemove ?? true) && props.onRemove !== undefined
    const onRemove = props.onRemove || noop
    const isEmpty = props.selectedItems.length === 0
    return (
        <div className="selected-items-container">
            {isEmpty ? (
                <div className="empty">{props.emptyLabel}</div>
            ) : (
                <div className="selected-items">
                    {props.selectedItems.map(item => (
                        <div
                            key={props.getLabel(item)}
                            className={classnames("selected-item", {
                                removable: canRemove
                            })}
                        >
                            <div className="label">{props.getLabel(item)}</div>
                            {canRemove && (
                                <div
                                    className="remove-icon"
                                    onClick={() => onRemove(item)}
                                >
                                    <FontAwesomeIcon icon={faTimes} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export interface GlobalEntityControlProps {
    globalEntitySelection: GlobalEntitySelection
}

@observer
export class GlobalEntityControl extends React.Component<
    GlobalEntityControlProps
> {
    refContainer: React.RefObject<HTMLDivElement> = React.createRef()
    disposers: IReactionDisposer[] = []

    @observable isNarrow: boolean = true
    @observable isOpen: boolean = false

    @observable.ref allCountries: GlobalEntitySelectionEntity[] = countries

    componentDidMount() {
        this.onResize()
        window.addEventListener("resize", this.onResizeThrottled)
        this.disposers.push(
            reaction(
                () => this.isOpen,
                () => this.sortAllCountries()
            )
        )
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.onResizeThrottled)
        this.disposers.forEach(dispose => dispose())
    }

    private onResizeThrottled = throttle(this.onResize, 200)
    @action.bound private onResize() {
        const container = this.refContainer.current
        if (container) {
            this.isNarrow = container.offsetWidth <= 640
        }
    }

    @computed private get selectedCountries(): GlobalEntitySelectionEntity[] {
        return this.props.globalEntitySelection.selectedEntities
    }

    @action.bound setSelectedCountries(
        countries: GlobalEntitySelectionEntity[]
    ) {
        this.props.globalEntitySelection.selectedEntities = countries
    }

    @bind private isSelected(country: GlobalEntitySelectionEntity) {
        return this.selectedCountries
            .map(country => country.code)
            .includes(country.code)
    }

    private getOptionValue(country: GlobalEntitySelectionEntity) {
        return country.code
    }

    private getOptionLabel(country: GlobalEntitySelectionEntity) {
        return country.name
    }

    @action.bound private sortAllCountries() {
        this.allCountries = orderBy(
            this.allCountries,
            [this.isSelected, country => country.name],
            ["desc", "asc"]
        )
    }

    @action.bound private onChange(
        countries: ValueType<GlobalEntitySelectionEntity>
    ) {
        if (countries == null) return
        if (!isMultiValue(countries)) {
            countries = [countries]
        }
        this.setSelectedCountries(Array.from(countries))
    }

    @action.bound private onRemove(
        countryToRemove: GlobalEntitySelectionEntity
    ) {
        this.setSelectedCountries(
            this.selectedCountries.filter(
                country => country !== countryToRemove
            )
        )
    }

    @action.bound private onMenuOpen() {
        this.isOpen = true
    }

    @action.bound private onMenuClose() {
        this.isOpen = false
    }

    renderNarrow() {
        return (
            <React.Fragment>
                <div
                    className={classnames("narrow-summary", {
                        "narrow-summary-selected-items": !this.isOpen
                    })}
                >
                    {this.isOpen ? (
                        <EntitySelect
                            options={this.allCountries}
                            getOptionValue={this.getOptionValue}
                            getOptionLabel={this.getOptionLabel}
                            onChange={this.onChange}
                            value={this.selectedCountries}
                            menuIsOpen={this.isOpen}
                            autoFocus={true}
                        />
                    ) : (
                        <React.Fragment>
                            {this.selectedCountries.length === 0
                                ? "None selected"
                                : this.selectedCountries
                                      .map(country => (
                                          <span
                                              className="narrow-summary-selected-item"
                                              key={country.code}
                                          >
                                              {country.name}
                                          </span>
                                      ))
                                      .reduce(
                                          (acc, item) =>
                                              acc.length === 0
                                                  ? [item]
                                                  : [...acc, ", ", item],
                                          [] as (JSX.Element | string)[]
                                      )}
                        </React.Fragment>
                    )}
                </div>
                <div className="narrow-actions">
                    {this.isOpen ? (
                        <button className="button" onClick={this.onMenuClose}>
                            Done
                        </button>
                    ) : (
                        <button className="button" onClick={this.onMenuOpen}>
                            {this.selectedCountries.length === 0
                                ? "Select countries"
                                : "Edit"}
                        </button>
                    )}
                </div>
            </React.Fragment>
        )
    }

    renderWide() {
        return (
            <React.Fragment>
                <div className="select-dropdown-container">
                    <EntitySelect
                        options={this.allCountries}
                        getOptionValue={this.getOptionValue}
                        getOptionLabel={this.getOptionLabel}
                        onChange={this.onChange}
                        value={this.selectedCountries}
                        onMenuOpen={this.onMenuOpen}
                        onMenuClose={this.onMenuClose}
                    />
                </div>
                <SelectedItems
                    selectedItems={this.selectedCountries}
                    getLabel={this.getOptionLabel}
                    onRemove={this.onRemove}
                    emptyLabel="Select countries to show on all charts"
                />
            </React.Fragment>
        )
    }

    render() {
        return (
            <div
                className={classnames("global-entity-control", {
                    "is-narrow": this.isNarrow,
                    "is-wide": !this.isNarrow
                })}
                ref={this.refContainer}
            >
                {this.isNarrow ? this.renderNarrow() : this.renderWide()}
            </div>
        )
    }
}

export function bakeGlobalEntityControl($: CheerioStatic) {
    $("*[data-entity-select]").each((_, el) => {
        const $el = $(el)
        const $section = $el.closest("section")

        // Remove the "marker" element and inject a new section.
        // We need a separate section in order to make position:sticky work.
        $el.remove()
        const $container = $(
            `<div data-global-entity-control class="global-entity-control-container" />`
        )
        const rendered = ReactDOMServer.renderToString(
            <GlobalEntityControl
                globalEntitySelection={new GlobalEntitySelection()}
            />
        )
        $container.html(rendered).insertAfter($section)
    })
}

export function runGlobalEntityControl(
    globalEntitySelection: GlobalEntitySelection
) {
    const element = document.querySelector("*[data-global-entity-control]")
    if (element) {
        ReactDOM.hydrate(
            <GlobalEntityControl
                globalEntitySelection={globalEntitySelection}
            />,
            element
        )
        // We only want to bind the URL if a global control element exists
        globalEntitySelection.bindUrlParamsToWindow()
    }
}
