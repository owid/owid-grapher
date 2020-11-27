import React from "react"
import { observer } from "mobx-react"
import { action, computed } from "mobx"
import Select from "react-select"
import { getStylesForTargetHeight } from "clientUtils/react-select"
import {
    ExplorerControlType,
    ExplorerChoiceOption,
    ExplorerChoice,
} from "./ExplorerConstants"
import { splitArrayIntoGroupsOfN } from "clientUtils/Util"
import { GridBoolean } from "explorer/gridLang/GridLangConstants"
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

@observer
export class ExplorerControlPanel extends React.Component<{
    choice: ExplorerChoice
    explorerSlug?: string
    onChange?: (value: string) => void
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
                    data-track-note={`${
                        explorerSlug ?? "explorer"
                    }-click-${title.toLowerCase()}`}
                >
                    <input
                        onChange={() => this.customOnChange(onChangeValue)}
                        type={isCheckbox ? "checkbox" : "radio"}
                        disabled={!available}
                        name={title}
                        checked={checked}
                        value={currentValue}
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

        const styles = getStylesForTargetHeight(16)

        return (
            <Select
                className={EXPLORER_DROPDOWN_CLASS}
                classNamePrefix={EXPLORER_DROPDOWN_CLASS}
                isDisabled={options.length < 2}
                menuPlacement="auto"
                options={options}
                value={value}
                onChange={(option: any) => this.customOnChange(option.value)}
                components={{
                    IndicatorSeparator: null,
                }}
                styles={styles}
                isSearchable={options.length > 20}
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
            return splitArrayIntoGroupsOfN(
                options,
                3
            ).map((optionsGroup, column) =>
                this.renderColumn(`${title}${column}`, column > 0, optionsGroup)
            )
        return this.renderColumn(title, type === ExplorerControlType.Checkbox)
    }
}
