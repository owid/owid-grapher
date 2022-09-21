/* Forms.tsx
 * ================
 *
 * Reusable React components to keep admin UI succint and consistent
 */

import React from "react"
import * as lodash from "lodash"
import { bind } from "decko"
import { observable, action, makeObservable } from "mobx";
import { observer } from "mobx-react"

import { pick, capitalize } from "../clientUtils/Util.js"
import { Colorpicker } from "./Colorpicker.js"
import { faCog } from "@fortawesome/free-solid-svg-icons/faCog"
import { faLink } from "@fortawesome/free-solid-svg-icons/faLink"
import { faPaintbrush } from "@fortawesome/free-solid-svg-icons/faPaintbrush"
import { faUnlink } from "@fortawesome/free-solid-svg-icons/faUnlink"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

export class FieldsRow extends React.Component<{ children: React.ReactNode }> {
    render() {
        return <div className="FieldsRow">{this.props.children}</div>
    }
}

interface TextFieldProps extends React.HTMLAttributes<HTMLInputElement> {
    label?: string
    value: string | undefined
    onValue: (value: string) => void
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
    buttonText?: string
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

    @bind onBlur() {
        const { value = "" } = this.props
        const trimmedValue = value.trim()
        this.props.onValue(trimmedValue)
    }

    componentDidMount() {
        if (this.props.autofocus) {
            const input = this.base.current!.querySelector("input")!
            input.focus()
        }
    }

    render() {
        const { props } = this
        const passthroughProps = pick(props, [
            "placeholder",
            "title",
            "disabled",
            "required",
            "onBlur",
        ])

        return (
            <div className="form-group" ref={this.base}>
                {props.label && <label>{props.label}</label>}
                <div className="input-group">
                    <input
                        className="form-control"
                        type="text"
                        value={props.value || ""}
                        onChange={(e) =>
                            this.props.onValue(e.currentTarget.value)
                        }
                        onBlur={this.onBlur}
                        onKeyDown={this.onKeyDown}
                        {...passthroughProps}
                    />
                    {props.buttonText && (
                        <button
                            className="btn btn-outline-secondary"
                            type="button"
                            onClick={() =>
                                props.onButtonClick && props.onButtonClick()
                            }
                        >
                            {props.buttonText}
                        </button>
                    )}
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
        this.props.onValue(value)
    }

    @bind onBlur() {
        const { value = "" } = this.props
        const trimmedValue = value.trim()
        this.props.onValue(trimmedValue)
    }

    render() {
        const { props } = this
        const passthroughProps = pick(props, [
            "placeholder",
            "title",
            "disabled",
            "label",
            "rows",
        ])

        return (
            <div className="form-group">
                {props.label && <label>{props.label}</label>}
                <textarea
                    className="form-control"
                    value={props.value}
                    onChange={this.onChange}
                    onBlur={this.onBlur}
                    rows={5}
                    {...passthroughProps}
                />
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
    onEnter?: () => void
    onEscape?: () => void
    placeholder?: string
    title?: string
    disabled?: boolean
    helpText?: string
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
            onBlur: () =>
                this.setState({
                    inputValue: undefined,
                }),
        }

        return <TextField {...textFieldProps} />
    }
}

interface SelectFieldProps {
    label?: string
    value: string | undefined
    onValue: (value: string) => void
    options: Option[]
    helpText?: string
    placeholder?: string
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
    label: string | JSX.Element
    value: boolean
    onValue: (value: boolean) => void
    disabled?: boolean
    title?: string
}

export class Toggle extends React.Component<ToggleProps> {
    constructor(props: ToggleProps) {
        super(props);

        makeObservable(this, {
            onChange: action.bound
        });
    }

    onChange(e: React.ChangeEvent<HTMLInputElement>) {
        this.props.onValue(!!e.currentTarget.checked)
    }

    render() {
        const { props } = this
        const passthroughProps = pick(props, ["label", "disabled", "title"])

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

export const ColorBox = observer(class ColorBox extends React.Component<{
    color: string | undefined
    onColor: (color: string | undefined) => void
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
});

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

interface AutoTextFieldProps {
    label?: string
    value: string | undefined
    placeholder?: string
    isAuto: boolean
    helpText?: string
    onValue: (value: string) => void
    onToggleAuto: (value: boolean) => void
    softCharacterLimit?: number
    onBlur?: () => void
}

const ErrorMessage = ({ message }: { message: string }) => (
    <div style={{ color: "red" }}>{message}</div>
)

const SoftCharacterLimit = observer(class SoftCharacterLimit extends React.Component<{
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
});

export const AutoTextField = observer(class AutoTextField extends React.Component<AutoTextFieldProps> {
    render() {
        const { props } = this

        return (
            <div className="form-group AutoTextField">
                {props.label && <label>{props.label}</label>}
                <div className="input-group mb-2 mb-sm-0">
                    <input
                        type="text"
                        className="form-control"
                        value={props.value}
                        placeholder={props.placeholder}
                        onChange={(e) => props.onValue(e.currentTarget.value)}
                        onBlur={props.onBlur}
                    />
                    <div
                        className="input-group-addon"
                        onClick={() => props.onToggleAuto(!props.isAuto)}
                        title={
                            props.isAuto ? "Automatic default" : "Manual input"
                        }
                    >
                        {props.isAuto ? (
                            <FontAwesomeIcon icon={faLink} />
                        ) : (
                            <FontAwesomeIcon icon={faUnlink} />
                        )}
                    </div>
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
            </div>
        )
    }
});

export const BindString = observer(class BindString extends React.Component<{
    field: string
    store: Record<string, any>
    label?: string
    placeholder?: string
    helpText?: string
    textarea?: boolean
    softCharacterLimit?: number
    disabled?: boolean
    rows?: number
    errorMessage?: string
    buttonText?: string
    onButtonClick?: () => void
}> {
    constructor(
        props: {
            field: string
            store: Record<string, any>
            label?: string
            placeholder?: string
            helpText?: string
            textarea?: boolean
            softCharacterLimit?: number
            disabled?: boolean
            rows?: number
            errorMessage?: string
            buttonText?: string
            onButtonClick?: () => void
        }
    ) {
        super(props);

        makeObservable(this, {
            onValue: action.bound,
            onBlur: action.bound
        });
    }

    onValue(value: string = "") {
        this.props.store[this.props.field] = value
    }

    onBlur() {
        const trimmedValue = this.props.store[this.props.field]?.trim()
        this.props.store[this.props.field] = trimmedValue
    }

    render() {
        const { field, store, label, textarea, ...rest } = this.props
        const value = store[field] as string | undefined
        if (textarea)
            return (
                <TextAreaField
                    label={label === undefined ? capitalize(field) : label}
                    value={value || ""}
                    onValue={this.onValue}
                    onBlur={this.onBlur}
                    {...rest}
                />
            )
        else
            return (
                <TextField
                    label={label === undefined ? capitalize(field) : label}
                    value={value || ""}
                    onValue={this.onValue}
                    onBlur={this.onBlur}
                    {...rest}
                />
            )
    }
});

export const BindAutoString = observer(class BindAutoString<
    T extends { [field: string]: any },
    K extends keyof T
> extends React.Component<{
    field: K
    store: T
    auto: string
    label?: string
    helpText?: string
    softCharacterLimit?: number
    onBlur?: () => void
}> {
    constructor(
        props: {
            field: K
            store: T
            auto: string
            label?: string
            helpText?: string
            softCharacterLimit?: number
            onBlur?: () => void
        }
    ) {
        super(props);

        makeObservable(this, {
            onValue: action.bound,
            onToggleAuto: action.bound,
            onBlur: action.bound
        });
    }

    onValue(value: string) {
        this.props.store[this.props.field] = value as any
    }

    onToggleAuto(value: boolean) {
        this.props.store[this.props.field] = (
            value ? undefined : this.props.auto
        ) as any
    }

    onBlur() {
        const trimmedValue = this.props.store[this.props.field]?.trim()
        this.props.store[this.props.field] = trimmedValue
    }

    render() {
        const { field, store, label, auto, ...rest } = this.props

        const value = store[field] as string | undefined

        return (
            <AutoTextField
                label={label || capitalize(field)}
                value={value === undefined ? auto : value}
                isAuto={value === undefined}
                onValue={this.onValue}
                onBlur={this.onBlur}
                onToggleAuto={this.onToggleAuto}
                {...rest}
            />
        )
    }
});

interface AutoFloatFieldProps {
    label?: string
    value: number
    isAuto: boolean
    helpText?: string
    onValue: (value: number | undefined) => void
    onToggleAuto: (value: boolean) => void
    onBlur?: () => void
}

class AutoFloatField extends React.Component<AutoFloatFieldProps> {
    render() {
        const { props } = this

        const textFieldProps = {
            ...props,
            value: props.isAuto ? undefined : props.value.toString(),
            onValue: (value: string) => {
                const asNumber = parseFloat(value)
                props.onValue(isNaN(asNumber) ? undefined : asNumber)
            },
            placeholder: props.isAuto ? props.value.toString() : undefined,
        }

        return <AutoTextField {...textFieldProps} />
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

        const textFieldProps = {
            ...props,
            value:
                props.value === undefined ? undefined : props.value.toString(),
            onValue: (value: string) => {
                const asNumber = parseFloat(value)
                props.onValue(isNaN(asNumber) ? undefined : asNumber)
            },
        }

        return <TextField {...textFieldProps} />
    }
}

export const BindFloat = observer(class BindFloat<
    T extends { [field: string]: any },
    K extends keyof T
> extends React.Component<{
    field: K
    store: T
    label?: string
    helpText?: string
}> {
    constructor(
        props: {
            field: K
            store: T
            label?: string
            helpText?: string
        }
    ) {
        super(props);

        makeObservable(this, {
            onValue: action.bound
        });
    }

    onValue(value: number | undefined) {
        this.props.store[this.props.field] = value as any
    }

    render() {
        const { field, store, label, ...rest } = this.props

        const value = store[field] as number | undefined

        return (
            <FloatField
                label={label || capitalize(field)}
                value={value}
                onValue={this.onValue}
                {...rest}
            />
        )
    }
});

export const BindAutoFloat = observer(class BindAutoFloat<
    T extends { [field: string]: any },
    K extends keyof T
> extends React.Component<{
    field: K
    store: T
    auto: number
    label?: string
    helpText?: string
    onBlur?: () => void
}> {
    constructor(
        props: {
            field: K
            store: T
            auto: number
            label?: string
            helpText?: string
            onBlur?: () => void
        }
    ) {
        super(props);

        makeObservable(this, {
            onValue: action.bound,
            onToggleAuto: action.bound
        });
    }

    onValue(value: number | undefined) {
        this.props.store[this.props.field] = value as any
    }

    onToggleAuto(value: boolean) {
        this.props.store[this.props.field] = (
            value ? undefined : this.props.auto
        ) as any
    }

    render() {
        const { field, store, label, auto, ...rest } = this.props

        const value = store[field] as number | undefined

        return (
            <AutoFloatField
                label={label || capitalize(field)}
                value={value === undefined ? auto : value}
                isAuto={value === undefined}
                onValue={this.onValue}
                onToggleAuto={this.onToggleAuto}
                {...rest}
            />
        )
    }
});

export const Modal = observer(class Modal extends React.Component<{
    className?: string
    onClose: () => void
}> {
    base: React.RefObject<HTMLDivElement> = React.createRef()
    dismissable: boolean = true

    constructor(
        props: {
            className?: string
            onClose: () => void
        }
    ) {
        super(props);

        makeObservable(this, {
            onClickOutside: action.bound
        });
    }

    onClickOutside() {
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
});

export const LoadingBlocker = observer(class LoadingBlocker extends React.Component {
    render() {
        return (
            <div className="LoadingBlocker">
                <FontAwesomeIcon icon={faCog} spin fixedWidth size="3x" />
            </div>
        )
    }
});

import dayjs from "../clientUtils/dayjs.js"

export const Timeago = observer(class Timeago extends React.Component<{
    time: dayjs.ConfigType
    by?: string | JSX.Element | null | undefined
}> {
    render() {
        return (
            <>
                {this.props.time && dayjs(this.props.time).fromNow()}
                {this.props.by != null && <> by {this.props.by}</>}
            </>
        )
    }
});

import { TagBadge, Tag } from "./TagBadge.js"

import ReactTags from "react-tag-autocomplete"
import { Tippy } from "../grapher/chart/Tippy.js"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons/faExclamationTriangle"

const EditTags = observer(class EditTags extends React.Component<{
    tags: Tag[]
    suggestions: Tag[]
    onDelete: (index: number) => void
    onAdd: (tag: Tag) => void
    onSave: () => void
}> {
    dismissable: boolean = true

    constructor(
        props: {
            tags: Tag[]
            suggestions: Tag[]
            onDelete: (index: number) => void
            onAdd: (tag: Tag) => void
            onSave: () => void
        }
    ) {
        super(props);

        makeObservable(this, {
            onClickSomewhere: action.bound,
            onClick: action.bound
        });
    }

    onClickSomewhere() {
        if (this.dismissable) this.props.onSave()
        this.dismissable = true
    }

    onClick() {
        this.dismissable = false
    }

    componentDidMount() {
        document.addEventListener("click", this.onClickSomewhere)
    }

    componentWillUnmount() {
        document.removeEventListener("click", this.onClickSomewhere)
    }

    render() {
        const { tags, suggestions } = this.props
        return (
            <div className="EditTags" onClick={this.onClick}>
                <ReactTags
                    tags={tags}
                    suggestions={suggestions}
                    onAddition={this.props.onAdd}
                    onDelete={this.props.onDelete}
                    minQueryLength={1}
                />
            </div>
        )
    }
});

const filterUncategorizedTag = (t: Tag) => t.name !== "Uncategorized"

export const EditableTags = observer(class EditableTags extends React.Component<{
    tags: Tag[]
    suggestions: Tag[]
    onSave: (tags: Tag[]) => void
    disabled?: boolean
    hasKeyChartSupport?: boolean
}> {
    isEditing: boolean = false;
    base: React.RefObject<HTMLDivElement> = React.createRef()

    tags: Tag[] = lodash.clone(this.props.tags);

    constructor(
        props: {
            tags: Tag[]
            suggestions: Tag[]
            onSave: (tags: Tag[]) => void
            disabled?: boolean
            hasKeyChartSupport?: boolean
        }
    ) {
        super(props);

        makeObservable(this, {
            isEditing: observable,
            tags: observable,
            onAddTag: action.bound,
            onRemoveTag: action.bound,
            onToggleKey: action.bound,
            ensureUncategorized: action.bound,
            onToggleEdit: action.bound
        });
    }

    onAddTag(tag: Tag) {
        this.tags.push(tag)
        this.tags = lodash
            .uniqBy(this.tags, (t) => t.id)
            .filter(filterUncategorizedTag)

        this.ensureUncategorized()
    }

    onRemoveTag(index: number) {
        this.tags.splice(index, 1)
        this.ensureUncategorized()
    }

    onToggleKey(index: number) {
        this.tags[index].isKey = !this.tags[index].isKey
        this.props.onSave(this.tags.filter(filterUncategorizedTag))
    }

    ensureUncategorized() {
        if (this.tags.length === 0) {
            const uncategorized = this.props.suggestions.find(
                (t) => t.name === "Uncategorized"
            )
            if (uncategorized) this.tags.push(uncategorized)
        }
    }

    onToggleEdit() {
        if (this.isEditing) {
            this.props.onSave(this.tags.filter(filterUncategorizedTag))
        }
        this.isEditing = !this.isEditing
    }

    componentDidMount() {
        this.componentDidUpdate()
    }

    componentDidUpdate() {
        this.ensureUncategorized()
    }

    render() {
        const { disabled, hasKeyChartSupport } = this.props
        const { tags } = this

        return (
            <div className="EditableTags">
                {this.isEditing ? (
                    <EditTags
                        tags={this.tags}
                        onAdd={this.onAddTag}
                        onDelete={this.onRemoveTag}
                        onSave={this.onToggleEdit}
                        suggestions={this.props.suggestions}
                    />
                ) : (
                    <div>
                        {tags.map((t, i) => (
                            <TagBadge
                                onToggleKey={
                                    hasKeyChartSupport
                                        ? () => this.onToggleKey(i)
                                        : undefined
                                }
                                key={t.id}
                                tag={t}
                            />
                        ))}
                        {!disabled && (
                            <button
                                className="btn btn-link"
                                onClick={this.onToggleEdit}
                            >
                                Edit Tags
                            </button>
                        )}
                    </div>
                )}
            </div>
        )
    }
});

export const Button = observer(class Button extends React.Component<{
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
});
