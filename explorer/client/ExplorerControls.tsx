import React from "react"
import { observer } from "mobx-react"
import { action } from "mobx"
import classNames from "classnames"
import Select from "react-select"
import { getStylesForTargetHeight } from "utils/client/react-select"
import { ExplorerControlType, ExplorerControlOption } from "./ExplorerConstants"

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
    title: string
    name: string
    explorerSlug: string
    value?: string
    options: ExplorerControlOption[]
    type: ExplorerControlType
    comment?: string
    onChange: (value: string) => void
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
                            : "UnavailableOption",
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

    private renderDropdown() {
        const options = this.props
            .options!.filter((option) => option.available)
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
        this.props.onChange!(value)
    }

    private renderCheckboxesOrRadios() {
        return this.props.options.map((option, index) =>
            this.renderCheckboxOrRadio(option, index)
        )
    }

    render() {
        const { title, name, type } = this.props
        const hideTitle =
            this.props.hideTitle || type === ExplorerControlType.Checkbox
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
                {type === ExplorerControlType.Dropdown
                    ? this.renderDropdown()
                    : this.renderCheckboxesOrRadios()}
            </div>
        )
    }
}
