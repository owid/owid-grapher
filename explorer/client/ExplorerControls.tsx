import React from "react"
import { observer } from "mobx-react"
import { action } from "mobx"
import classNames from "classnames"
import Select from "react-select"
import { getStylesForTargetHeight } from "utils/client/react-select"

export interface DropdownOption {
    label: string
    available: boolean
    value: string
}

export interface ControlOption extends DropdownOption {
    checked: boolean
}

export class ExplorerControlBar extends React.Component<{
    isMobile: boolean
    showControls: boolean
    closeControls: () => void
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
        ) : (
            undefined
        )

        const showMobileControls = isMobile && showControls
        return (
            <div
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
            </div>
        )
    }
}

@observer
export class ExplorerControlPanel extends React.Component<{
    title: string
    name: string
    explorerSlug: string
    value?: string
    options: ControlOption[]
    dropdownOptions?: DropdownOption[]
    isCheckbox?: boolean
    comment?: string
    onChange: (value: string) => void
    hideTitle?: boolean
}> {
    renderOption(option: ControlOption, index: number) {
        const {
            title,
            name,
            comment,
            isCheckbox,
            explorerSlug,
            value
        } = this.props
        const onChangeValue = isCheckbox
            ? option.checked
                ? ""
                : option.value
            : option.value
        return (
            <div key={index} className="ControlOption">
                <label
                    className={[
                        option.checked ? "SelectedOption" : "Option",
                        option.available
                            ? "AvailableOption"
                            : "UnavailableOption"
                    ].join(" ")}
                    data-track-note={`${explorerSlug}-click-${title.toLowerCase()}`}
                >
                    <input
                        onChange={() => this.props.onChange(onChangeValue)}
                        type={isCheckbox ? "checkbox" : "radio"}
                        disabled={!option.available}
                        name={name}
                        checked={option.available && option.checked}
                        value={value}
                    />{" "}
                    {option.label}
                    {comment && (
                        <div
                            className={[
                                "comment",
                                option.available
                                    ? "AvailableOption"
                                    : "UnavailableOption"
                            ].join(" ")}
                        >
                            {comment}
                        </div>
                    )}
                </label>
            </div>
        )
    }

    get renderDropdown() {
        const options = this.props
            .dropdownOptions!.filter(option => option.available)
            .map(option => {
                return {
                    label: option.label,
                    value: option.value
                }
            })

        const styles = getStylesForTargetHeight(16, {
            singleValue: {
                color: "#7a899e" /* Match the unselected text */
            }
        })

        return (
            <Select
                className="intervalDropdown"
                classNamePrefix="intervalDropdown"
                isDisabled={options.length < 2}
                menuPlacement="auto"
                options={options}
                value={
                    options.find(
                        option => option.value === this.props.value
                    ) || { label: "-", value: "-" }
                }
                onChange={(option: any) => this.customOnChange(option.value)}
                components={{
                    IndicatorSeparator: null
                }}
                styles={styles}
                isSearchable={false}
            />
        )
    }

    @action.bound customOnChange(value: string) {
        this.props.onChange!(value)
    }

    get renderOptions() {
        return this.props.options.map((option, index) =>
            this.renderOption(option, index)
        )
    }

    render() {
        const { title, hideTitle, name } = this.props
        return (
            <div key={name} className={classNames("ExplorerControl", name)}>
                <div
                    className={
                        "ControlHeader" +
                        (hideTitle === true ? " HiddenControlHeader" : "")
                    }
                >
                    {title}
                </div>
                {this.props.dropdownOptions?.length
                    ? this.renderDropdown
                    : this.renderOptions}
            </div>
        )
    }
}
