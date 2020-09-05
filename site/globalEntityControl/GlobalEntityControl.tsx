import * as React from "react"
import * as ReactDOM from "react-dom"
import * as ReactDOMServer from "react-dom/server"
import { computed, action, observable, IReactionDisposer, reaction } from "mobx"
import { observer } from "mobx-react"
import Select, {
    ValueType,
    components,
    OptionProps,
    Props,
    GroupedOptionsType
} from "react-select"
import classnames from "classnames"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"

import { countries } from "utils/countries"
import {
    throttle,
    noop,
    getCountryCodeFromNetlifyRedirect,
    sortBy
} from "charts/utils/Util"
import {
    GlobalEntitySelection,
    GlobalEntitySelectionEntity,
    GlobalEntitySelectionModes
} from "./GlobalEntitySelection"
import { asArray } from "utils/client/react-select"
import { Analytics } from "charts/core/Analytics"
import { ENV } from "settings"

const allEntities = sortBy(countries, c => c.name)
    // Add 'World'
    .concat([
        {
            name: "World",
            code: "OWID_WRL",
            slug: "world"
        }
    ])

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

interface GlobalEntityControlProps {
    globalEntitySelection: GlobalEntitySelection
}

@observer
class GlobalEntityControl extends React.Component<GlobalEntityControlProps> {
    refContainer: React.RefObject<HTMLDivElement> = React.createRef()
    disposers: IReactionDisposer[] = []

    @observable private isNarrow: boolean = true
    @observable private isOpen: boolean = false
    @observable private localEntity: GlobalEntitySelectionEntity | undefined

    @observable.ref
    private selectOptions: GroupedOptionsType<GlobalEntitySelectionEntity> = []

    componentDidMount() {
        this.onResize()
        window.addEventListener("resize", this.onResizeThrottled)
        this.disposers.push(
            reaction(
                () => this.isOpen,
                () => this.prepareSelectOptions()
            )
        )
        this.populateLocalEntity()
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

    @action.bound async populateLocalEntity() {
        try {
            const localCountryCode = await getCountryCodeFromNetlifyRedirect()
            if (localCountryCode) {
                const [country] = allEntities.filter(
                    c => c.code === localCountryCode
                )
                if (country) {
                    this.localEntity = country
                }
            }
        } catch (e) {}
    }

    @computed private get selectedEntities(): GlobalEntitySelectionEntity[] {
        return this.props.globalEntitySelection.selectedEntities
    }

    @action.bound setSelectedEntities(
        countries: GlobalEntitySelectionEntity[]
    ) {
        this.props.globalEntitySelection.mode =
            GlobalEntitySelectionModes.override
        this.props.globalEntitySelection.selectedEntities = countries
    }

    private getOptionValue(entity: GlobalEntitySelectionEntity) {
        return entity.code
    }

    private getOptionLabel(entity: GlobalEntitySelectionEntity) {
        return entity.name
    }

    @action.bound private prepareSelectOptions(): GroupedOptionsType<
        GlobalEntitySelectionEntity
    > {
        let optionGroups: GroupedOptionsType<GlobalEntitySelectionEntity> = []
        // We want to include the local country, but not if it's already selected, it adds
        // unnecessary duplication.
        if (
            this.localEntity &&
            !this.selectedEntities.includes(this.localEntity)
        ) {
            optionGroups = optionGroups.concat([
                {
                    label: "Suggestions",
                    options: [this.localEntity]
                }
            ])
        }
        if (this.selectedEntities.length > 0) {
            optionGroups = optionGroups.concat([
                {
                    label: "Selected",
                    options: this.selectedEntities
                }
            ])
        }
        optionGroups = optionGroups.concat([
            {
                label: "All countries",
                options: allEntities
            }
        ])
        this.selectOptions = optionGroups
        return optionGroups
    }

    analytics = new Analytics(ENV)

    @action.bound private onChange(
        newEntities: ValueType<GlobalEntitySelectionEntity>
    ) {
        const entities = asArray(newEntities)

        this.setSelectedEntities(entities)

        this.analytics.logGlobalEntityControl(
            "change",
            entities.map(c => c.code).join(",")
        )
    }

    @action.bound private onRemove(
        entityToRemove: GlobalEntitySelectionEntity
    ) {
        this.setSelectedEntities(
            this.selectedEntities.filter(entity => entity !== entityToRemove)
        )
    }

    @action.bound private onMenuOpen() {
        this.isOpen = true
    }

    @action.bound private onMenuClose() {
        this.isOpen = false
    }

    @action.bound private onButtonOpen(
        event: React.MouseEvent<HTMLButtonElement>
    ) {
        this.analytics.logGlobalEntityControl(
            "open",
            event.currentTarget.innerText
        )
        this.onMenuOpen()
    }

    @action.bound private onButtonClose(
        event: React.MouseEvent<HTMLButtonElement>
    ) {
        this.analytics.logGlobalEntityControl(
            "close",
            event.currentTarget.innerText
        )
        this.onMenuClose()
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
                            options={this.selectOptions}
                            getOptionValue={this.getOptionValue}
                            getOptionLabel={this.getOptionLabel}
                            onChange={this.onChange}
                            value={this.selectedEntities}
                            menuIsOpen={this.isOpen}
                            autoFocus={true}
                        />
                    ) : (
                        <React.Fragment>
                            {this.selectedEntities.length === 0
                                ? "None selected"
                                : this.selectedEntities
                                      .map(entity => (
                                          <span
                                              className="narrow-summary-selected-item"
                                              key={entity.code}
                                          >
                                              {entity.name}
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
                        <button className="button" onClick={this.onButtonClose}>
                            Done
                        </button>
                    ) : (
                        <button className="button" onClick={this.onButtonOpen}>
                            {this.selectedEntities.length === 0
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
                        options={this.selectOptions}
                        getOptionValue={this.getOptionValue}
                        getOptionLabel={this.getOptionLabel}
                        onChange={this.onChange}
                        value={this.selectedEntities}
                        onMenuOpen={this.onMenuOpen}
                        onMenuClose={this.onMenuClose}
                    />
                </div>
                <SelectedItems
                    selectedItems={this.selectedEntities}
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
                onClick={
                    this.isNarrow && !this.isOpen ? this.onMenuOpen : undefined
                }
            >
                {this.isNarrow ? this.renderNarrow() : this.renderWide()}
            </div>
        )
    }
}

const DATA_ATTR = "data-global-entity-control"

export function bakeGlobalEntityControl($: CheerioStatic) {
    // The data attr used to be `data-entity-select`, but later changed for consistency in the code.
    // But we should still support the old attribute.
    $(`*[data-entity-select], *[${DATA_ATTR}]`).each((_, el) => {
        const $el = $(el)
        const $section = $el.closest("section")

        const rendered = ReactDOMServer.renderToString(
            <GlobalEntityControl
                globalEntitySelection={new GlobalEntitySelection()}
            />
        )

        // Move the element to top-level where <section>s are,
        // in order to make position:sticky work.
        $el.remove()
        $el.attr(DATA_ATTR, "")
        $el.addClass("global-entity-control-container")
        $el.html(rendered).insertAfter($section)
    })
}

export function runGlobalEntityControl(
    globalEntitySelection: GlobalEntitySelection
) {
    const element = document.querySelector(`*[${DATA_ATTR}]`)
    if (element) {
        ReactDOM.hydrate(
            <GlobalEntityControl
                globalEntitySelection={globalEntitySelection}
            />,
            element
        )
        // We only want to bind the URL if a global control element exists
        globalEntitySelection.bindUrlParamsToWindow()
        // Load default set of countries if none are selected
        const countryAttr = element.getAttribute("data-default-country")
        if (
            countryAttr &&
            globalEntitySelection.selectedEntities.length === 0
        ) {
            const countryCodes = countryAttr.split(/[+,]/g)
            globalEntitySelection.selectByCountryCodes(countryCodes)
            globalEntitySelection.mode = GlobalEntitySelectionModes.override
        }
    }
}
