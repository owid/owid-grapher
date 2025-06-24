/* Forms.tsx
 * ================
 *
 * Reusable React components to keep admin UI succint and consistent
 */

import * as _ from "lodash-es"
import * as React from "react"
import { useState } from "react"
import { bind } from "decko"
import { action } from "mobx"
import { observer } from "mobx-react"
import cx from "classnames"
import { useTimeout } from "usehooks-ts"

import { dayjs, Tippy, copyToClipboard } from "@ourworldindata/utils"
import { Colorpicker } from "./Colorpicker.js"
import {
    faCog,
    faLink,
    faPaintbrush,
    faUnlink,
    faExclamationTriangle,
    faCircleInfo,
    faCopy,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

export class FieldsRow extends React.Component<{ children: React.ReactNode }> {
    render() {
        return <div className="FieldsRow">{this.props.children}</div>
    }
}

interface TextFieldProps extends React.HTMLAttributes<HTMLInputElement> {
    label?: React.ReactNode
    secondaryLabel?: string
    value: string | undefined
    onValue?: (value: string) => void
    onEnter?: () => void
    onEscape?: () => void
    onButtonClick?: () => void
    placeholder?: string
    title?: string
    disabled?: boolean
    helpText?: string
    autofocus?: boolean
    required?: boolean
    rows?: number
    softCharacterLimit?: number
    errorMessage?: string
    buttonContent?: React.ReactNode
    buttonTooltipContent?: React.ReactNode
    buttonDisabled?: boolean
}

export class TextField extends React.Component<TextFieldProps> {
    base: React.RefObject<HTMLDivElement>
    constructor(props: TextFieldProps) {
        super(props)
        this.base = React.createRef()
    }

    @bind onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
        if (ev.key === "Enter" && this.props.onEnter) {
            this.props.onEnter()
            ev.preventDefault()
        } else if (ev.key === "Escape" && this.props.onEscape) {
            this.props.onEscape()
            ev.preventDefault()
        }
    }

    @bind onBlur(e: React.FocusEvent<HTMLInputElement>) {
        const { value = "" } = this.props
        const trimmedValue = value.trim()
        this.props.onValue?.(trimmedValue)
        this.props.onBlur?.(e)
    }

    componentDidMount() {
        if (this.props.autofocus) {
            const input = this.base.current!.querySelector("input")!
            input.focus()
        }
    }

    renderButton() {
        const { props } = this
        if (!props.buttonContent) return null

        const button = (
            <div className="input-group-append">
                <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={props.onButtonClick}
                    disabled={props.buttonDisabled}
                >
                    {props.buttonContent}
                </button>
            </div>
        )

        if (props.buttonTooltipContent) {
            return (
                <Tippy content={props.buttonTooltipContent} maxWidth={180}>
                    {button}
                </Tippy>
            )
        }

        return button
    }

    render() {
        const { props } = this
        const passthroughProps = _.pick(props, [
            "placeholder",
            "title",
            "disabled",
            "required",
        ])

        return (
            <div
                className={cx("form-group", this.props.className)}
                ref={this.base}
            >
                {props.label && (
                    <label>
                        {props.label}
                        {props.secondaryLabel && (
                            <>
                                <span> </span>
                                <FontAwesomeIcon
                                    icon={faCircleInfo}
                                    className="text-muted"
                                    title={props.secondaryLabel}
                                />
                            </>
                        )}
                    </label>
                )}
                <div className="input-group">
                    <input
                        className="form-control"
                        type="text"
                        value={props.value || ""}
                        onChange={(e) =>
                            this.props.onValue?.(e.currentTarget.value)
                        }
                        onBlur={this.onBlur}
                        onKeyDown={this.onKeyDown}
                        {...passthroughProps}
                    />
                    {this.renderButton()}
                </div>
                {props.helpText && (
                    <small className="form-text text-muted">
                        {props.helpText}
                    </small>
                )}
                {props.softCharacterLimit && props.value && (
                    <SoftCharacterLimit
                        text={props.value}
                        limit={props.softCharacterLimit}
                    />
                )}
                {props.errorMessage && (
                    <ErrorMessage message={props.errorMessage} />
                )}
            </div>
        )
    }
}

export class TextAreaField extends React.Component<TextFieldProps> {
    @bind onChange(ev: React.FormEvent<HTMLTextAreaElement>) {
        const value = ev.currentTarget.value
        this.props.onValue?.(value)
    }

    @bind onBlur() {
        const { value = "" } = this.props
        const trimmedValue = value.trim()
        this.props.onValue?.(trimmedValue)
    }

    renderButton() {
        const { props } = this
        if (!props.buttonContent) return null

        const button = (
            <div className="input-group-append">
                <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={props.onButtonClick}
                    disabled={props.buttonDisabled}
                >
                    {props.buttonContent}
                </button>
            </div>
        )

        if (props.buttonTooltipContent) {
            return (
                <Tippy content={props.buttonTooltipContent} maxWidth={180}>
                    {button}
                </Tippy>
            )
        }

        return button
    }

    render() {
        const { props } = this
        const passthroughProps = _.pick(props, [
            "placeholder",
            "title",
            "disabled",
            "label",
            "rows",
        ])

        return (
            <div className="form-group">
                {props.label && (
                    <label>
                        {props.label}
                        {props.secondaryLabel && (
                            <>
                                <span> </span>
                                <FontAwesomeIcon
                                    icon={faCircleInfo}
                                    className="text-muted"
                                    title={props.secondaryLabel}
                                />
                            </>
                        )}
                    </label>
                )}
                <div className="input-group">
                    <textarea
                        className="form-control"
                        value={props.value}
                        onChange={this.onChange}
                        onBlur={this.onBlur}
                        rows={5}
                        {...passthroughProps}
                    />
                    {this.renderButton()}
                </div>
                {props.helpText && (
                    <small className="form-text text-muted">
                        {props.helpText}
                    </small>
                )}
                {props.softCharacterLimit && props.value && (
                    <SoftCharacterLimit
                        text={props.value}
                        limit={props.softCharacterLimit}
                    />
                )}
                {props.errorMessage && (
                    <ErrorMessage message={props.errorMessage} />
                )}
            </div>
        )
    }
}

export class SearchField extends TextField {}

interface NumberFieldProps {
    label?: string
    value: number | undefined
    allowDecimal?: boolean
    allowNegative?: boolean
    onValue: (value: number | undefined) => void
    onBlur?: () => void
    onEnter?: () => void
    onEscape?: () => void
    placeholder?: string
    title?: string
    disabled?: boolean
    helpText?: string
    buttonContent?: React.ReactNode
    onButtonClick?: () => void
    buttonDisabled?: boolean
    resetButton?: Omit<WithResetButtonProps, "children">
}

interface NumberFieldState {
    /** The state of user input when not able to be parsed. Allows users to input intermediately un-parsable values */
    inputValue?: string
}

export class NumberField extends React.Component<
    NumberFieldProps,
    NumberFieldState
> {
    constructor(props: NumberFieldProps) {
        super(props)

        this.state = {
            inputValue: undefined,
        }
    }

    render() {
        const { props, state } = this

        const textFieldProps = {
            ...props,
            value: state.inputValue ?? props.value?.toString(),
            onValue: (value: string) => {
                const allowInputRegex = new RegExp(
                    (props.allowNegative ? "^-?" : "^") +
                        (props.allowDecimal ? "\\d*\\.?\\d*$" : "\\d*$")
                )
                if (!allowInputRegex.test(value)) return
                const asNumber = parseFloat(value)
                const isNumber = !isNaN(asNumber)
                const inputMatches = value === asNumber.toString()
                this.setState({ inputValue: inputMatches ? undefined : value })
                props.onValue(isNumber ? asNumber : undefined)
            },
            onBlur: () => {
                this.setState({
                    inputValue: undefined,
                })
                this.props.onBlur?.()
            },
        }

        if (props.resetButton) {
            return (
                <WithResetButton {...props.resetButton}>
                    <TextField {...textFieldProps} />
                </WithResetButton>
            )
        } else {
            return <TextField {...textFieldProps} />
        }
    }
}

interface WithResetButtonProps {
    children: React.ReactElement
    onClick: () => void
    content?: React.ReactNode
    disabled?: boolean
}

class WithResetButton extends React.Component<WithResetButtonProps> {
    render() {
        const { props } = this

        return (
            <div className="WithResetButton">
                {props.children}
                <button
                    className="btn btn-link ResetToDefaultButton"
                    onClick={props.onClick}
                    disabled={props.disabled}
                >
                    {props.content ??
                        (props.disabled
                            ? "Bound to data. Edit to unbind"
                            : "Bind to data")}
                </button>
            </div>
        )
    }
}

interface SelectFieldProps {
    label?: string
    value: string | undefined
    onValue: (value: string) => void
    options: Option[]
    helpText?: string
    placeholder?: string
    onBlur?: () => void
}

export class SelectField extends React.Component<SelectFieldProps> {
    render() {
        const { props } = this

        return (
            <div className="form-group">
                {props.label && <label>{props.label}</label>}
                <select
                    className="form-control"
                    onChange={(e) =>
                        props.onValue(e.currentTarget.value as string)
                    }
                    onBlur={this.props.onBlur}
                    value={props.value}
                    defaultValue={undefined}
                >
                    {props.placeholder ? (
                        <option key={undefined} value={undefined} hidden={true}>
                            {props.placeholder}
                        </option>
                    ) : null}
                    {props.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label || opt.value}
                        </option>
                    ))}
                </select>
                {props.helpText && (
                    <small className="form-text text-muted">
                        {props.helpText}
                    </small>
                )}
            </div>
        )
    }
}

interface Option {
    value: string
    label?: string
}

export interface SelectGroup {
    title: string
    options: Option[]
}

interface SelectGroupsFieldProps {
    label?: string
    value: string | undefined
    onValue: (value: string) => void
    options: Option[]
    groups: SelectGroup[]
    helpText?: string
}

export class SelectGroupsField extends React.Component<SelectGroupsFieldProps> {
    render() {
        const { props } = this

        return (
            <div className="form-group">
                {props.label && <label>{props.label}</label>}
                <select
                    className="form-control"
                    onChange={(e) =>
                        props.onValue(e.currentTarget.value as string)
                    }
                    value={props.value}
                >
                    {props.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                    {props.groups.map((group) => (
                        <optgroup key={group.title} label={group.title}>
                            {group.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label || opt.value}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
                {props.helpText && (
                    <small className="form-text text-muted">
                        {props.helpText}
                    </small>
                )}
            </div>
        )
    }
}

interface RadioGroupOption {
    label?: string
    value: string
}

interface RadioGroupProps {
    options: RadioGroupOption[]
    value?: string
    onChange: (value: string) => void
    label?: string
}

export class RadioGroup extends React.Component<RadioGroupProps> {
    render() {
        return (
            <div className="form-group">
                {this.props.label && <label>{this.props.label}</label>}
                <div>
                    {this.props.options.map((option) => {
                        return (
                            <div
                                key={option.value}
                                className="form-check form-check-inline"
                            >
                                <input
                                    type="radio"
                                    className="form-check-input"
                                    id={option.value}
                                    checked={option.value === this.props.value}
                                    onChange={() =>
                                        this.props.onChange(option.value)
                                    }
                                />
                                <label
                                    className="form-check-label"
                                    htmlFor={option.value}
                                >
                                    {option.label || option.value}
                                </label>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }
}

interface NumberOption {
    value: number
    label?: string
}

interface NumericSelectFieldProps {
    label?: string
    value: number | undefined
    onValue: (value: number) => void
    options: NumberOption[]
    helpText?: string
}

export class NumericSelectField extends React.Component<NumericSelectFieldProps> {
    render() {
        const props = {
            ...this.props,
            value:
                this.props.value !== undefined
                    ? this.props.value.toString()
                    : "",
            options: this.props.options.map((opt) => ({
                value: opt.value.toString(),
                label: opt.label?.toString(),
            })),
            onValue: (value: string | undefined) => {
                const asNumber = parseFloat(value as string)
                this.props.onValue(asNumber)
            },
        }
        return <SelectField {...props} />
    }
}

interface ToggleProps {
    label: string | React.ReactElement
    value: boolean
    onValue: (value: boolean) => void
    disabled?: boolean
    title?: string
    secondaryLabel?: string
}

export class Toggle extends React.Component<ToggleProps> {
    @action.bound onChange(e: React.ChangeEvent<HTMLInputElement>) {
        this.props.onValue(!!e.currentTarget.checked)
    }

    render() {
        const { props } = this
        const passthroughProps = _.pick(props, ["label", "disabled", "title"])

        return (
            <div className="form-check">
                <label className="form-check-label">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        checked={props.value}
                        onChange={this.onChange}
                        {...passthroughProps}
                    />
                    {props.label}
                    {props.secondaryLabel && (
                        <>
                            {" "}
                            <FontAwesomeIcon
                                icon={faCircleInfo}
                                className="text-muted"
                                title={props.secondaryLabel}
                            />
                        </>
                    )}
                </label>
            </div>
        )
    }
}

export class EditableList extends React.Component<{ className?: string }> {
    render() {
        return this.props.children ? (
            <ul
                {...this.props}
                className={
                    "list-group" +
                    (this.props.className ? ` ${this.props.className}` : "")
                }
            />
        ) : null
    }
}

export interface EditableListItemProps
    extends React.HTMLAttributes<HTMLLIElement> {
    className?: string
}

export class EditableListItem extends React.Component<EditableListItemProps> {
    render() {
        return (
            <li
                {...this.props}
                className={
                    "list-group-item" +
                    (this.props.className ? ` ${this.props.className}` : "")
                }
            />
        )
    }
}

@observer
export class ColorBox extends React.Component<{
    color: string | undefined
    onColor: (color: string | undefined) => void
    showLineChartColors: boolean
}> {
    render() {
        const { color } = this.props

        const style =
            color !== undefined ? { backgroundColor: color } : undefined

        return (
            <Tippy
                content={
                    <>
                        <Colorpicker
                            color={color}
                            onColor={this.props.onColor}
                            showLineChartColors={this.props.showLineChartColors}
                        />
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                flexDirection: "column",
                            }}
                        >
                            <Button
                                onClick={() => this.props.onColor(undefined)}
                            >
                                Reset to color scheme default
                            </Button>
                        </div>
                    </>
                }
                placement="right"
                interactive={true}
                trigger="click"
                appendTo={() => document.body}
                className="colorpicker-tooltip"
            >
                <div className="ColorBox" style={style}>
                    {color === undefined && (
                        <FontAwesomeIcon icon={faPaintbrush} />
                    )}
                </div>
            </Tippy>
        )
    }
}

export class Section extends React.Component<{ name: string }> {
    render() {
        return (
            <section>
                <h5>{this.props.name}</h5>
                {this.props.children}
            </section>
        )
    }
}

type AutoTextFieldProps = TextFieldProps & {
    isAuto: boolean
    onToggleAuto: (value: boolean) => void
    onBlur?: () => void
    textarea?: boolean
}

const ErrorMessage = ({ message }: { message: string }) => (
    <div style={{ color: "red" }}>{message}</div>
)

@observer
class SoftCharacterLimit extends React.Component<{
    text: string
    limit: number
}> {
    render() {
        const { text, limit } = this.props
        return (
            <div
                style={
                    text.length > limit
                        ? { color: "#D17D05" }
                        : { color: "rgba(0,0,0,0.3)" }
                }
            >
                {text.length} / {limit}
                {text.length > limit && (
                    <p>
                        <FontAwesomeIcon icon={faExclamationTriangle} /> This
                        text is long and may cause rendering issues in smaller
                        viewports.
                    </p>
                )}
            </div>
        )
    }
}

@observer
export class AutoTextField extends React.Component<AutoTextFieldProps> {
    render() {
        const props = this.props
        const { textarea } = props

        const Field = textarea ? TextAreaField : TextField
        return (
            <Field
                {...props}
                buttonContent={
                    <div>
                        {props.isAuto ? (
                            <FontAwesomeIcon icon={faLink} />
                        ) : (
                            <FontAwesomeIcon icon={faUnlink} />
                        )}
                    </div>
                }
                buttonTooltipContent={
                    <div style={{ textAlign: "center" }}>
                        {props.isAuto
                            ? "Automatic default. Edit to override"
                            : "Automatic default overwritten. Click to reset"}
                    </div>
                }
                onButtonClick={() => props.onToggleAuto(!props.isAuto)}
                buttonDisabled={props.isAuto}
            />
        )
    }
}

@observer
export class BindString extends React.Component<{
    field: string
    store: Record<string, any>
    label?: React.ReactNode
    secondaryLabel?: string
    placeholder?: string
    helpText?: string
    textarea?: boolean
    softCharacterLimit?: number
    disabled?: boolean
    rows?: number
    errorMessage?: string
    buttonContent?: React.ReactChild
    onButtonClick?: () => void
    onBlur?: () => void
}> {
    @action.bound onValue(value: string = "") {
        this.props.store[this.props.field] = value
    }

    @action.bound onBlur() {
        const trimmedValue = this.props.store[this.props.field]?.trim()
        this.props.store[this.props.field] = trimmedValue
        this.props.onBlur?.()
    }

    render() {
        const { field, store, label, textarea, ...rest } = this.props
        const value = store[field] as string | undefined
        if (textarea)
            return (
                <TextAreaField
                    label={label === undefined ? _.capitalize(field) : label}
                    secondaryLabel={this.props.secondaryLabel}
                    value={value || ""}
                    onValue={this.onValue}
                    onBlur={this.onBlur}
                    {...rest}
                />
            )
        else
            return (
                <TextField
                    label={label === undefined ? _.capitalize(field) : label}
                    secondaryLabel={this.props.secondaryLabel}
                    value={value || ""}
                    onValue={this.onValue}
                    onBlur={this.onBlur}
                    {...rest}
                />
            )
    }
}

@observer
export class BindStringArray extends React.Component<{
    field: string
    store: Record<string, any>
    label?: React.ReactNode
    secondaryLabel?: string
    placeholder?: string
    helpText?: string
    softCharacterLimit?: number
    disabled?: boolean
    rows?: number
    errorMessage?: string
    buttonContent?: React.ReactChild
    onButtonClick?: () => void
}> {
    @action.bound onValue(value: string = "") {
        this.props.store[this.props.field] = parseBulletList(value)
    }

    render() {
        const { field, store, label, ...rest } = this.props
        const values = store[field] as string[] | []
        return (
            <TextAreaField
                label={label === undefined ? _.capitalize(field) : label}
                secondaryLabel={this.props.secondaryLabel}
                value={createBulletList(values || [])}
                onValue={this.onValue}
                {...rest}
            />
        )
    }
}

@observer
export class BindDropdown extends React.Component<{
    field: string
    store: Record<string, any>
    label?: React.ReactNode
    options: Array<{ value: string; label: string }>
    disabled?: boolean
}> {
    @action.bound onChange(event: React.ChangeEvent<HTMLSelectElement>) {
        const value = event.target.value
        this.props.store[this.props.field] = value
    }

    render() {
        const { field, store, label, options, disabled } = this.props
        const value = store[field] || "" // Default to empty string if no value is set

        return (
            <div>
                {label && <label>{label}</label>}{" "}
                <select
                    value={value}
                    onChange={this.onChange}
                    disabled={disabled}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
        )
    }
}

@observer
export class BindAutoString<
    T extends { [field: string]: any },
    K extends Extract<keyof T, string>,
> extends React.Component<{
    field: K
    store: T
    auto: string
    label?: string
    helpText?: string
    errorMessage?: string
    softCharacterLimit?: number
    onBlur?: () => void
    placeholder?: string
    textarea?: boolean
}> {
    @action.bound onValue(value: string) {
        this.props.store[this.props.field] = value as any
    }

    @action.bound onToggleAuto(value: boolean) {
        this.props.store[this.props.field] = (
            value ? undefined : this.props.auto
        ) as any
    }

    @action.bound onBlur() {
        const trimmedValue = this.props.store[this.props.field]?.trim()
        this.props.store[this.props.field] = trimmedValue
        this.props.onBlur?.()
    }

    render() {
        const { field, store, label, auto, ...rest } = this.props

        const value = store[field] as string | undefined

        return (
            <AutoTextField
                label={label || _.capitalize(field)}
                value={value === undefined ? auto : value}
                isAuto={value === undefined}
                onValue={this.onValue}
                onToggleAuto={this.onToggleAuto}
                {...rest}
                onBlur={this.onBlur}
            />
        )
    }
}

/** This text field is for cases where you want to have a text field or text area
    with a button that be linked/unlinked to either use a default value or override it.

    To use it you need to provide 4 props:
    - readFn: a function that returns the current value of the field
    - writeFn: a function that writes a value to the field
    - store: the object that contains the field
    - isAuto: a boolean that indicates whether the field is linked or not

    readFn and writeFn can either read and write from the same property or different ones -
    the latter is useful so that one property can provide the overridden value or the default value.
    isAuto has to reliably determine if the default value is used or not.

    ```tsx
    <BindAutoStringExt
        label={"Subtitle"}
        readFn={(g) => g.currentSubtitle}
        writeFn={(g, newVal) => (g.subtitle = newVal)}
        isAuto={grapher.subtitle === undefined}
        store={grapher}
    />
    ```
 */
@observer
export class BindAutoStringExt<
    T extends Record<string, any>,
> extends React.Component<
    {
        readFn: (x: T) => string
        writeFn: (x: T, value: string | undefined) => void
        store: T
        auto?: string
    } & Omit<
        AutoTextFieldProps,
        "onValue" | "onToggleAuto" | "value" | "isBlur"
    >
> {
    @action.bound onValue(value: string | undefined = "") {
        this.props.writeFn(this.props.store, value)
    }

    @action.bound onBlur() {
        if (!this.props.isAuto) {
            const trimmedValue = this.props.readFn(this.props.store).trim()
            this.props.writeFn(this.props.store, trimmedValue)
        }
    }

    @action.bound onToggleAuto(value: boolean) {
        this.props.writeFn(
            this.props.store,
            value ? this.props.auto : this.props.readFn(this.props.store)
        )
    }

    render() {
        const { readFn, auto, store, ...rest } = this.props
        const currentReadValue = this.props.isAuto
            ? (auto ?? readFn(store))
            : readFn(store)
        return (
            <AutoTextField
                value={currentReadValue || ""}
                onValue={this.onValue}
                onBlur={this.onBlur}
                onToggleAuto={this.onToggleAuto}
                {...rest}
            />
        )
    }
}

interface AutoFloatFieldProps {
    label?: string
    value: number
    isAuto: boolean
    helpText?: string
    onValue: (value: number | undefined) => void
    onToggleAuto: (value: boolean) => void
    onBlur?: () => void
    resetButton?: Omit<WithResetButtonProps, "children">
}

class AutoFloatField extends React.Component<AutoFloatFieldProps> {
    render() {
        const { props } = this

        return (
            <NumberField
                allowDecimal
                allowNegative
                {...props}
                value={props.isAuto ? undefined : props.value}
                placeholder={props.isAuto ? props.value?.toString() : undefined}
                buttonContent={
                    <Tippy
                        content={
                            <div style={{ textAlign: "center" }}>
                                {props.isAuto
                                    ? "Automatic default. Edit to override"
                                    : "Automatic default overwritten. Click to reset"}
                            </div>
                        }
                        maxWidth={180}
                    >
                        <div>
                            {props.isAuto ? (
                                <FontAwesomeIcon icon={faLink} />
                            ) : (
                                <FontAwesomeIcon icon={faUnlink} />
                            )}
                        </div>
                    </Tippy>
                }
                onButtonClick={() => props.onToggleAuto(!props.isAuto)}
                buttonDisabled={props.isAuto}
                resetButton={props.resetButton}
            />
        )
    }
}

interface FloatFieldProps {
    label?: string
    value: number | undefined
    helpText?: string
    onValue: (value: number | undefined) => void
}

class FloatField extends React.Component<FloatFieldProps> {
    render() {
        const { props } = this

        return <NumberField {...props} allowDecimal allowNegative />
    }
}

@observer
export class BindFloat<
    T extends { [field: string]: any },
    K extends Extract<keyof T, string>,
> extends React.Component<{
    field: K
    store: T
    label?: string
    helpText?: string
    disabled?: boolean
}> {
    @action.bound onValue(value: number | undefined) {
        this.props.store[this.props.field] = value as any
    }

    render() {
        const { field, store, label, ...rest } = this.props

        const value = store[field] as number | undefined

        return (
            <FloatField
                label={label || _.capitalize(field)}
                value={value}
                onValue={this.onValue}
                {...rest}
            />
        )
    }
}

@observer
export class BindAutoFloat<
    T extends { [field: string]: any },
    K extends Extract<keyof T, string>,
> extends React.Component<{
    field: K
    store: T
    auto: number
    label?: string
    helpText?: string
    onBlur?: () => void
}> {
    @action.bound onValue(value: number | undefined) {
        this.props.store[this.props.field] = value as any
    }

    @action.bound onToggleAuto(value: boolean) {
        this.props.store[this.props.field] = (
            value ? undefined : this.props.auto
        ) as any
    }

    render() {
        const { field, store, label, auto, ...rest } = this.props

        const value = store[field] as number | undefined

        return (
            <AutoFloatField
                label={label || _.capitalize(field)}
                value={value === undefined ? auto : value}
                isAuto={value === undefined}
                onValue={this.onValue}
                onToggleAuto={this.onToggleAuto}
                {...rest}
            />
        )
    }
}

@observer
export class BindAutoFloatExt<
    T extends Record<string, any>,
> extends React.Component<
    {
        readFn: (x: T) => number
        writeFn: (x: T, value: number | undefined) => void
        store: T
        auto?: number
    } & Omit<AutoFloatFieldProps, "onValue" | "onToggleAuto" | "value">
> {
    @action.bound onValue(value: number | undefined) {
        this.props.writeFn(this.props.store, value)
    }

    @action.bound onToggleAuto(value: boolean) {
        this.props.writeFn(
            this.props.store,
            value ? this.props.auto : this.props.readFn(this.props.store)
        )
    }

    render() {
        const { readFn, auto, store, ...rest } = this.props
        const currentReadValue = this.props.isAuto
            ? (auto ?? readFn(store))
            : readFn(store)
        return (
            <AutoFloatField
                value={currentReadValue}
                onValue={this.onValue}
                onToggleAuto={this.onToggleAuto}
                {...rest}
            />
        )
    }
}

@observer
export class Modal extends React.Component<{
    className?: string
    onClose: () => void
}> {
    base: React.RefObject<HTMLDivElement> = React.createRef()
    dismissable: boolean = true

    @action.bound onClickOutside() {
        if (this.dismissable) this.props.onClose()
    }

    componentDidMount() {
        // HACK (Mispy): The normal ways of doing this (stopPropagation etc) don't seem to work here
        this.base.current!.addEventListener("click", () => {
            this.dismissable = false
            setTimeout(() => (this.dismissable = true), 100)
        })
        setTimeout(
            () => document.body.addEventListener("click", this.onClickOutside),
            0
        )
    }

    componentWillUnmount() {
        document.body.removeEventListener("click", this.onClickOutside)
    }

    render() {
        const { props } = this
        return (
            <div
                className={
                    "modal" + (props.className ? ` ${props.className}` : "")
                }
                style={{ display: "block" }}
            >
                <div ref={this.base} className="modal-dialog" role="document">
                    <div className="modal-content">{this.props.children}</div>
                </div>
            </div>
        )
    }
}

export const CatalogPathField = ({
    catalogPath,
}: {
    catalogPath: string | undefined
}) => {
    let tokenizedCatalogPath: React.ReactNode

    if (!catalogPath)
        tokenizedCatalogPath = <span style={{ color: "gray" }}>(none)</span>
    else {
        const [datasetName, indicatorName] = catalogPath.split("#")

        if (!datasetName || !indicatorName) tokenizedCatalogPath = catalogPath

        // Tokenize, color and word-break any slashes, underscores, and hashes
        tokenizedCatalogPath = (
            <>
                {[...datasetName].map((char, i) => {
                    if (char === "/")
                        return (
                            <span key={i} style={{ color: "gray" }}>
                                <wbr />/
                            </span>
                        )
                    return char
                })}
                <span style={{ color: "#91577c" }}>
                    <wbr />#
                </span>
                <span style={{ color: "#2162e6" }}>
                    {[...indicatorName].map((char, i) => {
                        if (char === "_")
                            return (
                                <span key={i}>
                                    <wbr />_
                                </span>
                            )
                        return char
                    })}
                </span>
            </>
        )
    }

    return (
        <div className="form-group catalog-path-field">
            <label>Catalog path</label>
            <div className="input-group">
                <pre className="form-control">{tokenizedCatalogPath}</pre>
                <div className="input-group-append">
                    <button
                        className="btn btn-outline-secondary"
                        onClick={async () =>
                            catalogPath && (await copyToClipboard(catalogPath))
                        }
                        disabled={!catalogPath}
                    >
                        <FontAwesomeIcon icon={faCopy} />
                    </button>
                </div>
            </div>
        </div>
    )
}

export function LoadingBlocker() {
    const [isVisible, setIsVisible] = useState(false)
    useTimeout(() => setIsVisible(true), 200)
    // When an action completes fast (which is quite often) the user won't be
    // annoyed by an intermediate flash of the spinner on the screen.
    if (!isVisible) return null
    return (
        <div className="LoadingBlocker">
            <FontAwesomeIcon icon={faCog} spin fixedWidth size="3x" />
        </div>
    )
}

@observer
export class Timeago extends React.Component<{
    time: dayjs.ConfigType
    by?: string | React.ReactElement | null | undefined
}> {
    render() {
        return (
            <>
                {this.props.time && dayjs(this.props.time).fromNow()}
                {this.props.by && <> by {this.props.by}</>}
            </>
        )
    }
}

@observer
export class Button extends React.Component<{
    children: any
    onClick: () => void
}> {
    render() {
        return (
            <button className="btn btn-link" onClick={this.props.onClick}>
                {this.props.children}
            </button>
        )
    }
}

export const Help = ({ children }: { children: React.ReactNode }) => (
    <small className="form-text text-muted mb-4">{children}</small>
)

const createBulletList = (items: string[]): string => {
    return items.map((item) => `• ${item}`).join("\n")
}

const parseBulletList = (bulletedString: string): string[] => {
    // Return an array with a single empty string if the input is empty
    if (bulletedString === "") {
        return [""]
    }

    const items = bulletedString
        .split(/\n•\s?/)
        .map((item) => item.replace(/^•\s?/, ""))

    // Check if the input string ends with a newline. If it does, ensure the last item is an empty string.
    if (bulletedString.endsWith("\n")) {
        items[items.length - 1] = items[items.length - 1].trim()
        items.push("")
    }

    return items
}
