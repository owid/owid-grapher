import React from "react"
import { observer } from "mobx-react"
import { action, computed } from "mobx"
import { components, SingleValueProps } from "react-select"
import { ReactSelect as Select } from "../clientUtils/import-shims.js"
import { getStylesForTargetHeight } from "../clientUtils/react-select.js"
import {
    ExplorerControlType,
    ExplorerChoiceOption,
    ExplorerChoice,
} from "./ExplorerConstants.js"
import { chunk } from "../clientUtils/Util.js"
import { GridBoolean } from "../gridLang/GridLangConstants.js"
import classNames from "classnames"

const AVAILABLE_OPTION_CLASS = "AvailableOption"
const UNAVAILABLE_OPTION_CLASS = "UnavailableOption"
const SELECTED_OPTION_CLASS = "SelectedOption"
const EXPLORER_DROPDOWN_CLASS = "ExplorerDropdown"
const HIDDEN_CONTROL_HEADER_CLASS = "HiddenControlHeader"

export class ExplorerControlBar extends React.Component<{
    isMobile?: boolean
    showControls?: boolean
    closeControls?: () => void
}> {
    render() {
        const { isMobile, showControls, closeControls } = this.props
        const mobileCloseButton = isMobile ? (
            <a
                className="btn btn-primary mobile-button"
                onClick={closeControls}
            >
                Done
            </a>
        ) : undefined

        const showMobileControls = isMobile && showControls
        return (
            <form
                className={classNames(
                    "ExplorerControlBar",
                    showMobileControls
                        ? `show-controls-popup`
                        : isMobile
                        ? `hide-controls-popup`
                        : false
                )}
            >
                {this.props.children}
                {mobileCloseButton}
            </form>
        )
    }
}

interface ExplorerDropdownOption {
    label: string
    value: string
}

const ExplorerSingleValue = (props: SingleValueProps) => {
    if (props.selectProps.isSearchable && props.selectProps.menuIsOpen)
        return (
            <components.SingleValue {...props}>
                <span style={{ fontStyle: "italic", opacity: 0.75 }}>
                    Type to search&hellip;
                </span>
            </components.SingleValue>
        )
    else return <components.SingleValue {...props} />
}

const ExplorerDropdown = (props: {
    options: ExplorerDropdownOption[]
    value: ExplorerDropdownOption
    isMobile: boolean
    onChange: (option: string) => void
}) => {
    const { options, value, isMobile, onChange } = props
    const styles = getStylesForTargetHeight(30)

    return (
        <Select
            className={EXPLORER_DROPDOWN_CLASS}
            classNamePrefix={EXPLORER_DROPDOWN_CLASS}
            isDisabled={options.length < 2}
            // menuPlacement="auto" doesn't work perfectly well on mobile, with fixed position
            menuPlacement={isMobile ? "top" : "auto"}
            menuPosition="absolute"
            options={options}
            value={value}
            onChange={(option: ExplorerDropdownOption) =>
                onChange(option.value)
            }
            components={{
                IndicatorSeparator: null,
                SingleValue: ExplorerSingleValue,
            }}
            styles={styles}
            isSearchable={!isMobile && options.length > 10}
            maxMenuHeight={350}
        />
    )
}

@observer
export class ExplorerControlPanel extends React.Component<{
    choice: ExplorerChoice
    explorerSlug?: string
    onChange?: (value: string) => void
    isMobile: boolean
}> {
    private renderCheckboxOrRadio(option: ExplorerChoiceOption, index: number) {
        const { explorerSlug, choice } = this.props
        const { title, type, value } = choice
        const { available, label, checked } = option
        const isCheckbox = type === ExplorerControlType.Checkbox
        const onChangeValue = isCheckbox
            ? checked
                ? GridBoolean.false
                : GridBoolean.true
            : option.value
        const currentValue = isCheckbox
            ? checked
                ? GridBoolean.true
                : GridBoolean.false
            : value

        return (
            <div key={index} className="ControlOption">
                <label
                    className={classNames(
                        {
                            [SELECTED_OPTION_CLASS]: checked,
                        },
                        available
                            ? AVAILABLE_OPTION_CLASS
                            : UNAVAILABLE_OPTION_CLASS
                    )}
                >
                    <input
                        onChange={() => this.customOnChange(onChangeValue)}
                        type={isCheckbox ? "checkbox" : "radio"}
                        disabled={!available}
                        name={title}
                        checked={checked}
                        value={currentValue}
                        data-track-note={`${
                            explorerSlug ?? "explorer"
                        }-click-${title.toLowerCase()}`}
                    />{" "}
                    {label}
                </label>
            </div>
        )
    }

    @computed private get options() {
        return this.props.choice.options ?? []
    }

    private renderDropdown() {
        const options = this.options
            .filter((option) => option.available)
            .map((option) => {
                return {
                    label: option.label,
                    value: option.value,
                }
            })
        const value = options.find(
            (option) => option.value === this.props.choice.value
        ) ?? { label: "-", value: "-" }

        return (
            <ExplorerDropdown
                options={options}
                value={value}
                isMobile={this.props.isMobile}
                onChange={this.customOnChange}
            />
        )
    }

    @action.bound private customOnChange(value: string) {
        if (this.props.onChange) this.props.onChange(value)
    }

    private renderColumn(
        key: string,
        hideTitle: boolean,
        options?: ExplorerChoiceOption[]
    ) {
        const { title, type, displayTitle } = this.props.choice
        return (
            <div key={key} className="ExplorerControl">
                <div
                    className={classNames("ControlHeader", {
                        [HIDDEN_CONTROL_HEADER_CLASS]: hideTitle === true,
                    })}
                >
                    {displayTitle ?? title}
                </div>
                {type === ExplorerControlType.Dropdown
                    ? this.renderDropdown()
                    : (options ?? this.options).map((option, index) =>
                          this.renderCheckboxOrRadio(option, index)
                      )}
            </div>
        )
    }

    render() {
        const { choice } = this.props
        const { title, type } = choice
        const { options } = this
        if (type === ExplorerControlType.Radio && options.length > 4)
            return chunk(options, 3).map((optionsGroup, column) =>
                this.renderColumn(`${title}${column}`, column > 0, optionsGroup)
            )
        return this.renderColumn(title, type === ExplorerControlType.Checkbox)
    }
}
