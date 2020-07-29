import React from "react"
import { observer } from "mobx-react"
import { action } from "mobx"
import classNames from "classnames"
import Select from "react-select"
import { getStylesForTargetHeight } from "utils/client/react-select"

export interface ControlOption {
    label: string
    checked: boolean
    onChange: (checked: boolean) => void
    available: boolean
}

export interface DropdownOption {
    label: string
    available: boolean
    value: string
}

@observer
export class ExplorerControl extends React.Component<{
    title: string
    name: string
    value?: string
    options: ControlOption[]
    dropdownOptions?: DropdownOption[]
    isCheckbox?: boolean
    comment?: string
    onChange?: (value: string) => void
    hideTitle?: boolean
}> {
    @action.bound onChange(ev: React.ChangeEvent<HTMLInputElement>) {
        this.props.options[parseInt(ev.currentTarget.value)].onChange(
            ev.currentTarget.checked
        )
    }

    renderOption(option: ControlOption, index: number) {
        const { title, name, comment, isCheckbox } = this.props
        return (
            <div key={index} className="ControlOption">
                <label
                    className={[
                        option.checked ? "SelectedOption" : "Option",
                        option.available
                            ? "AvailableOption"
                            : "UnavailableOption"
                    ].join(" ")}
                    data-track-note={`covid-click-${title.toLowerCase()}`}
                >
                    <input
                        onChange={option.available ? this.onChange : undefined}
                        type={isCheckbox ? "checkbox" : "radio"}
                        disabled={!option.available}
                        name={name}
                        checked={option.available && option.checked}
                        value={index}
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
            control: {
                border /* Keep it subtle */: 0,
                boxShadow:
                    "none" /* Remove the outline style because text is too close to it */
            },
            singleValue: {
                color: "#7a899e" /* Match the unselected text */,
                marginLeft:
                    "-3px" /* Shift the text left to align with header */
            }
        })

        return (
            <Select
                className="intervalDropdown"
                classNamePrefix="intervalDropdown"
                menuPlacement="auto"
                options={options}
                value={options.find(
                    option => option.value === this.props.value
                )}
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
        const { title, hideTitle } = this.props
        return (
            <div className={classNames("CovidDataExplorerControl", name)}>
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
