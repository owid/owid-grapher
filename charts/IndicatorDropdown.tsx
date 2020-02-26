import * as React from "react"
import { default as Select, ValueType, OptionProps, Styles } from "react-select"
import classnames from "classnames"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChevronDown } from "@fortawesome/free-solid-svg-icons/faChevronDown"
import { faChevronUp } from "@fortawesome/free-solid-svg-icons/faChevronUp"

import {
    ExplorerViewContext,
    ExplorerViewContextType
} from "./ExplorerViewContext"
import { Indicator } from "./Indicator"
import { StoreEntry } from "./Store"
import { bind } from "decko"

const unstyled = () => ({})

const selectStyles: Partial<Styles> = {
    option: unstyled,
    input: provided => ({
        ...provided,
        fontWeight: 700
    }),
    menuList: provided => ({
        ...provided,
        maxHeight: "calc(80vh - 160px)",
        overflowY: "auto",
        padding: 0
    }),
    menu: provided => ({
        ...provided,
        position: "static",
        boxShadow: "none",
        borderRadius: 0,
        margin: 0
    }),
    container: unstyled,
    control: provided => ({
        ...provided,
        minHeight: 42,
        fontSize: 18,
        color: "#002147",
        margin: 0,
        padding: 6,
        paddingLeft: 18,
        border: "none",
        borderBottom: "1px solid rgba(0,0,0,.1)",
        borderRadius: 0,
        "&:hover": { borderColor: "rgba(0,0,0,.1)" },
        boxShadow: "none",
        outline: "none",
        cursor: "text"
    }),
    placeholder: provided => ({
        ...provided,
        color: "rgba(0,0,0,.4)"
    }),
    valueContainer: unstyled
}

export interface IndicatorDropdownProps {
    placeholder: string
    indicatorEntry: StoreEntry<Indicator> | null
    onChangeId: (id: number) => void
}

@observer
export class IndicatorDropdown extends React.Component<IndicatorDropdownProps> {
    static contextType = ExplorerViewContext
    context!: ExplorerViewContextType

    static defaultProps = {
        placeholder: "Type to search..."
    }

    @observable.ref isOpenState: boolean = false

    @computed get isOpen(): boolean {
        return this.props.indicatorEntry === null || this.isOpenState
    }

    set isOpen(value: boolean) {
        this.isOpenState = value
    }

    @action.bound onOpen() {
        this.isOpen = true
    }

    @action.bound onClose() {
        this.isOpen = false
    }

    @action.bound onToggle() {
        if (this.isOpen) this.onClose()
        else this.onOpen()
    }

    @action.bound onChange(indicator: Indicator) {
        // The onChange method can return an array of values (when multiple
        // items can be selected) or a single value. Since we are certain that
        // we are not using the multi-option select we can force the type to be
        // a single value.
        this.props.onChangeId(indicator.id)
    }

    render() {
        const entry = this.props.indicatorEntry
        const entity = entry && entry.entity
        // return (
        //     <AsyncSelect
        //         className="indicator-dropdown"
        //         onChange={this.onChange}
        //         placeholder={this.props.placeholder}
        //         defaultOptions={true}
        //         loadOptions={this.loadOptions}
        //         getOptionValue={this.getValue}
        //         getOptionLabel={this.getLabel}
        //         value={entity}
        //     />
        // )
        return (
            <React.Fragment>
                <div className="indicator-dropdown" onClick={this.onToggle}>
                    <div className="indicator-current">
                        <div className="indicator-info">
                            <h1 className="indicator-title">
                                {entity ? (
                                    entity.title
                                ) : (
                                    <span className="none">
                                        {entry === null
                                            ? "Select an indicator"
                                            : "Loading..."}
                                    </span>
                                )}
                            </h1>
                            {entity && entity.sourceDesc && (
                                <div className="indicator-metadata">
                                    {entity.sourceDesc}
                                </div>
                            )}
                        </div>
                        <span className="icon">
                            <FontAwesomeIcon
                                icon={this.isOpen ? faChevronUp : faChevronDown}
                            />
                        </span>
                    </div>
                </div>
                {this.isOpen && (
                    <IndicatorBrowser
                        isOpen={this.isOpen}
                        onChange={this.onChange}
                        onClose={this.onClose}
                        selectedId={entry?.entity?.id}
                    />
                )}
            </React.Fragment>
        )
    }
}

interface IndicatorBrowserProps {
    isOpen: boolean
    onChange: (indicator: Indicator) => void
    onClose: () => void
    selectedId: number | undefined
}

@observer
export class IndicatorBrowser extends React.Component<IndicatorBrowserProps> {
    static contextType = ExplorerViewContext
    context!: ExplorerViewContextType

    @observable.ref isLoading: boolean = true
    @observable.ref indicators: Indicator[] = []
    @observable.ref search: string = ""

    async loadIndicators() {
        const storeEntries = await this.context.store.indicators.getAll()
        this.indicators = storeEntries
            .map(entry => entry.entity)
            .filter(entity => entity !== undefined) as Indicator[]
        this.isLoading = false
    }

    @computed get filteredIndicators(): Indicator[] {
        if (this.search) {
            return this.indicators.filter(
                indicator =>
                    (indicator.title || "")
                        .toLocaleLowerCase()
                        .indexOf(this.search.toLowerCase()) > -1
            )
        } else {
            return this.indicators
        }
    }

    getValue(indicator: Indicator): string {
        return `${indicator.id}`
    }

    @action.bound onInputChange(search: string) {
        this.search = search
    }

    @bind onChange(indicator: ValueType<Indicator>) {
        if (indicator !== undefined) {
            this.props.onChange(indicator as Indicator)
            this.onClose()
        }
    }

    @bind onClose() {
        this.props.onClose()
    }

    componentDidMount() {
        this.loadIndicators()
    }

    render() {
        if (this.isLoading) {
            return null
        }
        return (
            <React.Fragment>
                <div
                    className={classnames({
                        "indicator-browser": true,
                        "is-open": this.props.isOpen
                    })}
                >
                    <Select
                        autoFocus={true}
                        backspaceRemovesValue={false}
                        escapeClearsValue={false}
                        components={{
                            Option: IndicatorOptionWrapper,
                            DropdownIndicator: null,
                            IndicatorSeparator: null
                        }}
                        controlShouldRenderValue={false}
                        filterOption={() => true} // disable filtering, will be handled elsewhere
                        getOptionValue={this.getValue}
                        hideSelectedOptions={false}
                        isClearable={false}
                        isLoading={this.isLoading}
                        menuIsOpen={true}
                        onChange={this.onChange}
                        onInputChange={this.onInputChange}
                        options={this.filteredIndicators}
                        placeholder="Search..."
                        styles={selectStyles}
                        tabSelectsValue={false}
                        value={this.indicators.find(
                            i => i.id === this.props.selectedId
                        )}
                    />
                </div>
                {this.props.isOpen && <Blanket onClick={this.onClose} />}
            </React.Fragment>
        )
    }
}

const IndicatorOptionWrapper = (props: OptionProps<Indicator>) => {
    const {
        className,
        data,
        isDisabled,
        isFocused,
        isSelected,
        innerRef,
        innerProps
    } = props
    return (
        <div
            ref={innerRef}
            className={classnames(
                {
                    "indicator-option": true,
                    "indicator-option__disabled": isDisabled,
                    "indicator-option__focused": isFocused,
                    "indicator-option__selected": isSelected
                },
                className
            )}
            style={{ cursor: "pointer" }}
            {...innerProps}
        >
            <IndicatorOption indicator={data as Indicator} />
        </div>
    )
}

const IndicatorOption = (props: { indicator: Indicator }) => {
    const { indicator } = props
    return (
        <div className="indicator-list-item">
            <h3 className="title">{indicator.title}</h3>
            {indicator.subtitle && (
                <p className="subtitle">{indicator.subtitle}</p>
            )}
            {indicator.sourceDesc && (
                <p className="metadata">{indicator.sourceDesc}</p>
            )}
        </div>
    )
}

const Blanket = (props: any) => {
    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                zIndex: 10
            }}
            {...props}
        ></div>
    )
}
