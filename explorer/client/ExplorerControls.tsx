import React from "react"
import { observer } from "mobx-react"
import { action, computed } from "mobx"
import Select from "react-select"
import { getStylesForTargetHeight } from "utils/client/react-select"
import { ExplorerControlType, ExplorerControlOption } from "./ExplorerConstants"
import { splitArrayIntoGroupsOfN } from "grapher/utils/Util"
import { GridBoolean } from "./GridGrammarConstants"

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
                className={`ExplorerControlBar${
                    showMobileControls
                        ? ` show-controls-popup`
                        : isMobile
                        ? ` hide-controls-popup`
                        : ""
                }`}
            >
                {this.props.children}
                {mobileCloseButton}
            </form>
        )
    }
}

@observer
export class ExplorerControlPanel extends React.Component<{
    name: string
    type: ExplorerControlType
    options?: ExplorerControlOption[]
    title?: string
    onChange?: (value: string) => void
    explorerSlug?: string
    value?: string
    comment?: string
    hideTitle?: boolean
}> {
    private renderCheckboxOrRadio(
        option: ExplorerControlOption,
        index: number
    ) {
        const { title, name, comment, explorerSlug, type, value } = this.props
        const isCheckbox = type === ExplorerControlType.Checkbox
        const onChangeValue = isCheckbox
            ? option.checked
                ? GridBoolean.false
                : GridBoolean.true
            : option.value
        const currentValue = isCheckbox
            ? option.checked
                ? GridBoolean.true
                : GridBoolean.false
            : value
        const checked = !!(option.available && option.checked)
        return (
            <div key={index} className="ControlOption">
                <label
                    className={[
                        option.checked ? "SelectedOption" : "Option",
                        option.available
                            ? "AvailableOption"
                            : "UnavailableOption",
                    ].join(" ")}
                    data-track-note={`${explorerSlug ?? "explorer"}-click-${(
                        title ?? name
                    ).toLowerCase()}`}
                >
                    <input
                        onChange={() => {
                            if (this.props.onChange)
                                this.props.onChange(onChangeValue)
                        }}
                        type={isCheckbox ? "checkbox" : "radio"}
                        disabled={!option.available}
                        name={name}
                        checked={checked}
                        value={currentValue}
                    />{" "}
                    {option.label}
                    {comment && (
                        <div
                            className={[
                                "comment",
                                option.available
                                    ? "AvailableOption"
                                    : "UnavailableOption",
                            ].join(" ")}
                        >
                            {comment}
                        </div>
                    )}
                </label>
            </div>
        )
    }

    @computed private get options() {
        return this.props.options ?? []
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
            (option) => option.value === this.props.value
        ) ?? { label: "-", value: "-" }

        const styles = getStylesForTargetHeight(16)

        return (
            <Select
                className="intervalDropdown"
                classNamePrefix="intervalDropdown"
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

    renderColumn(
        key: string,
        hideTitle: boolean,
        options?: ExplorerControlOption[]
    ) {
        const { title, type } = this.props
        return (
            <div key={key} className="ExplorerControl">
                <div
                    className={
                        "ControlHeader" +
                        (hideTitle === true ? " HiddenControlHeader" : "")
                    }
                >
                    {title}
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
        const { name, type, hideTitle } = this.props
        const { options } = this
        if (type === ExplorerControlType.Radio && options.length > 3)
            return splitArrayIntoGroupsOfN(
                options,
                3
            ).map((optionsGroup, index) =>
                this.renderColumn(
                    `${name}${index}`,
                    hideTitle || index > 0,
                    optionsGroup
                )
            )
        return this.renderColumn(
            name,
            hideTitle || type === ExplorerControlType.Checkbox
        )
    }
}
