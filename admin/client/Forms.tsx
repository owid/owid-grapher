/* Forms.tsx
 * ================
 *
 * Reusable React components to keep admin UI succint and consistent
 */

import * as React from "react"
import * as _ from "lodash"
import { bind } from "decko"
import { observable, action } from "mobx"
import { observer } from "mobx-react"

import { extend, pick, capitalize } from "charts/Util"
import { Colorpicker } from "./Colorpicker"
import { faCog } from "@fortawesome/free-solid-svg-icons/faCog"
import { faLink } from "@fortawesome/free-solid-svg-icons/faLink"
import { faPaintBrush } from "@fortawesome/free-solid-svg-icons/faPaintBrush"
import { faUnlink } from "@fortawesome/free-solid-svg-icons/faUnlink"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export class FieldsRow extends React.Component<{}> {
    render() {
        const { props } = this
        return <div className="FieldsRow">{props.children}</div>
    }
}

export interface TextFieldProps extends React.HTMLAttributes<HTMLInputElement> {
    label?: string
    value: string | undefined
    onValue: (value: string) => void
    onEnter?: () => void
    onEscape?: () => void
    placeholder?: string
    title?: string
    disabled?: boolean
    helpText?: string
    autofocus?: boolean
    required?: boolean
    rows?: number
    softCharacterLimit?: number
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
            "required"
        ])

        return (
            <div className="form-group" ref={this.base}>
                {props.label && <label>{props.label}</label>}
                <input
                    className="form-control"
                    type="text"
                    value={props.value || ""}
                    onChange={e => this.props.onValue(e.currentTarget.value)}
                    onKeyDown={this.onKeyDown}
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
            </div>
        )
    }
}

export class TextAreaField extends React.Component<TextFieldProps> {
    @bind onChange(ev: React.FormEvent<HTMLTextAreaElement>) {
        const value = ev.currentTarget.value
        this.props.onValue(value)
    }

    render() {
        const { props } = this
        const passthroughProps = pick(props, [
            "placeholder",
            "title",
            "disabled",
            "label",
            "rows"
        ])

        return (
            <div className="form-group">
                {props.label && <label>{props.label}</label>}
                <textarea
                    className="form-control"
                    value={props.value}
                    onChange={this.onChange}
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
            </div>
        )
    }
}

export class SearchField extends TextField {}

export interface NumberFieldProps<TValue> {
    label?: string
    value?: TValue
    onValue: (value: TValue) => void
    onEnter?: () => void
    onEscape?: () => void
    placeholder?: string
    title?: string
    disabled?: boolean
    helpText?: string
}

/**
 * Like NumberField, but also capture the users text input
 */
export class NumberInputField extends React.Component<
    NumberFieldProps<NumericInputValue>
> {
    render() {
        const { props } = this

        const textFieldProps = extend({}, props, {
            value: props.value && props.value ? props.value.input : undefined,
            onValue: (value: string) => {
                const asNumber = parseFloat(value)
                const nValue: NumericInputValue = {
                    input: value,
                    value: isNaN(asNumber) ? undefined : asNumber
                }
                props.onValue(nValue)
            }
        })

        return <TextField {...textFieldProps} />
    }
}

export class NumberField extends React.Component<
    NumberFieldProps<number | undefined>
> {
    render() {
        const { props } = this

        const textFieldProps = extend({}, props, {
            value:
                props.value && props.value ? props.value.toString() : undefined,
            onValue: (value: string) => {
                const asNumber = parseFloat(value)
                props.onValue(isNaN(asNumber) ? undefined : asNumber)
            }
        })

        return <TextField {...textFieldProps} />
    }
}

export interface SelectFieldProps {
    label?: string
    value: string | undefined
    onValue: (value: string) => void
    options: string[]
    optionLabels?: string[]
    helpText?: string
    placeholder?: string
}

export class SelectField extends React.Component<SelectFieldProps> {
    render() {
        const { props } = this

        const options = props.options.map((opt, i) => {
            return {
                key: opt,
                value: opt,
                text: (props.optionLabels && props.optionLabels[i]) || opt
            }
        })

        return (
            <div className="form-group">
                {props.label && <label>{props.label}</label>}
                <select
                    className="form-control"
                    onChange={e =>
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
                    {options.map(opt => (
                        <option key={opt.value} value={opt.value}>
                            {opt.text}
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

export interface SelectGroupsFieldProps {
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
                    onChange={e =>
                        props.onValue(e.currentTarget.value as string)
                    }
                    value={props.value}
                >
                    {props.options.map(opt => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                    {props.groups.map(group => (
                        <optgroup key={group.title} label={group.title}>
                            {group.options.map(opt => (
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

export interface RadioGroupOption {
    label?: string
    value: string
}

export interface RadioGroupProps {
    options: RadioGroupOption[]
    value?: string
    onChange: (value: string) => void
}

export class RadioGroup extends React.Component<RadioGroupProps> {
    render() {
        return (
            <div className="RadioGroup">
                {this.props.options.map(option => {
                    return (
                        <div key={option.value} className="radioOption">
                            <input
                                type="radio"
                                id={option.value}
                                checked={option.value === this.props.value}
                                onChange={() =>
                                    this.props.onChange(option.value)
                                }
                            />
                            <label htmlFor={option.value}>
                                {option.label || option.value}
                            </label>
                        </div>
                    )
                })}
            </div>
        )
    }
}

export interface NumericSelectFieldProps {
    label?: string
    value: number | undefined
    onValue: (value: number) => void
    options: number[]
    optionLabels?: string[]
    helpText?: string
}

export class NumericSelectField extends React.Component<
    NumericSelectFieldProps
> {
    render() {
        const props = extend({}, this.props, {
            value:
                this.props.value !== undefined
                    ? this.props.value.toString()
                    : "",
            options: this.props.options.map(opt => opt.toString()),
            onValue: (value: string | undefined) => {
                const asNumber = parseFloat(value as string)
                this.props.onValue(asNumber)
            }
        })
        return <SelectField {...props} />
    }
}

export interface ToggleProps {
    label: string | JSX.Element
    value: boolean
    onValue: (value: boolean) => void
    disabled?: boolean
}

export class Toggle extends React.Component<ToggleProps> {
    @action.bound onChange(e: React.ChangeEvent<HTMLInputElement>) {
        this.props.onValue(!!e.currentTarget.checked)
    }

    render() {
        const { props } = this
        const passthroughProps = pick(props, ["title", "disabled"]) as any

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

export interface ButtonProps {
    onClick: () => void
    label?: string
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
}> {
    @observable.ref isChoosingColor = false

    @action.bound onClick() {
        this.isChoosingColor = !this.isChoosingColor
    }

    render() {
        const { color } = this.props
        const { isChoosingColor } = this

        const style =
            color !== undefined ? { backgroundColor: color } : undefined

        return (
            <div className="ColorBox" style={style} onClick={this.onClick}>
                {color === undefined && <FontAwesomeIcon icon={faPaintBrush} />}
                {isChoosingColor && (
                    <Colorpicker
                        color={color}
                        onColor={this.props.onColor}
                        onClose={() => (this.isChoosingColor = false)}
                    />
                )}
            </div>
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

export interface AutoTextFieldProps {
    label?: string
    value: string | undefined
    placeholder?: string
    isAuto: boolean
    helpText?: string
    onValue: (value: string) => void
    onToggleAuto: (value: boolean) => void
    softCharacterLimit?: number
}

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
                        ? { color: "red" }
                        : { color: "rgba(0,0,0,0.3)" }
                }
            >
                {text.length} / {limit}
                {text.length > limit && (
                    <p>
                        This text is long and may cause rendering issues in
                        smaller viewports.
                    </p>
                )}
            </div>
        )
    }
}

@observer
export class AutoTextField extends React.Component<AutoTextFieldProps> {
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
                        onChange={e => props.onValue(e.currentTarget.value)}
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
}

@observer
export class BindString<
    T extends { [field: string]: any },
    K extends keyof T
> extends React.Component<{
    field: K
    store: T
    label?: string
    placeholder?: string
    helpText?: string
    textarea?: boolean
    softCharacterLimit?: number
    disabled?: boolean
    rows?: number
}> {
    @action.bound onValue(value: string) {
        this.props.store[this.props.field] = (value || undefined) as any
    }

    render() {
        const { props } = this

        const { field, store, label, textarea, ...rest } = props
        const value = props.store[props.field] as string | undefined
        if (textarea)
            return (
                <TextAreaField
                    label={label === undefined ? capitalize(field) : label}
                    value={value || ""}
                    onValue={this.onValue}
                    {...rest}
                />
            )
        else
            return (
                <TextField
                    label={label === undefined ? capitalize(field) : label}
                    value={value || ""}
                    onValue={this.onValue}
                    {...rest}
                />
            )
    }
}

@observer
export class BindAutoString<
    T extends { [field: string]: any },
    K extends keyof T
> extends React.Component<{
    field: K
    store: T
    auto: string
    label?: string
    helpText?: string
    softCharacterLimit?: number
}> {
    @action.bound onValue(value: string) {
        this.props.store[this.props.field] = value as any
    }

    @action.bound onToggleAuto(value: boolean) {
        this.props.store[this.props.field] = (value
            ? undefined
            : this.props.auto) as any
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
                onToggleAuto={this.onToggleAuto}
                {...rest}
            />
        )
    }
}

export interface AutoFloatFieldProps {
    label?: string
    value: number
    isAuto: boolean
    helpText?: string
    onValue: (value: number | undefined) => void
    onToggleAuto: (value: boolean) => void
}

export class AutoFloatField extends React.Component<AutoFloatFieldProps> {
    render() {
        const { props } = this

        const textFieldProps = extend({}, props, {
            value: props.isAuto ? undefined : props.value.toString(),
            onValue: (value: string) => {
                const asNumber = parseFloat(value)
                props.onValue(isNaN(asNumber) ? undefined : asNumber)
            },
            placeholder: props.isAuto ? props.value.toString() : undefined
        })

        return <AutoTextField {...textFieldProps} />
    }
}

export interface FloatFieldProps {
    label?: string
    value: number | undefined
    helpText?: string
    onValue: (value: number | undefined) => void
}

export class FloatField extends React.Component<FloatFieldProps> {
    render() {
        const { props } = this

        const textFieldProps = extend({}, props, {
            value:
                props.value === undefined ? undefined : props.value.toString(),
            onValue: (value: string) => {
                const asNumber = parseFloat(value)
                props.onValue(isNaN(asNumber) ? undefined : asNumber)
            }
        })

        return <TextField {...textFieldProps} />
    }
}

@observer
export class BindFloat<
    T extends { [field: string]: any },
    K extends keyof T
> extends React.Component<{
    field: K
    store: T
    label?: string
    helpText?: string
}> {
    @action.bound onValue(value: number | undefined) {
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
}

@observer
export class BindAutoFloat<
    T extends { [field: string]: any },
    K extends keyof T
> extends React.Component<{
    field: K
    store: T
    auto: number
    label?: string
    helpText?: string
}> {
    @action.bound onValue(value: number | undefined) {
        this.props.store[this.props.field] = value as any
    }

    @action.bound onToggleAuto(value: boolean) {
        this.props.store[this.props.field] = (value
            ? undefined
            : this.props.auto) as any
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

@observer
export class LoadingBlocker extends React.Component<{}> {
    render() {
        return (
            <div className="LoadingBlocker">
                <FontAwesomeIcon icon={faCog} spin fixedWidth size="3x" />
            </div>
        )
    }
}

@observer
export class Pagination extends React.Component<{
    totalItems: number
    perPage: number
}> {
    render() {
        const { totalItems, perPage } = this.props
        const numPages = Math.ceil(totalItems / perPage)
        return (
            <nav>
                <ul className="pagination">
                    <li className="page-item">
                        <a className="page-link">Previous</a>
                    </li>
                    {_.range(1, numPages + 1).map(pageNum => (
                        <li className="page-item">
                            <a className="page-link">{pageNum}</a>
                        </li>
                    ))}
                    <li className="page-item">
                        <a className="page-link">Next</a>
                    </li>
                </ul>
            </nav>
        )
    }
}

const timeago = require("timeago.js")()

@observer
export class Timeago extends React.Component<{ time: Date }> {
    render() {
        return this.props.time ? timeago.format(this.props.time) : ""
    }
}

import { TagBadge, Tag } from "./TagBadge"
import { NumericInputValue } from "charts/ChartConfig"

// NOTE (Mispy): Using my own fork of this which is modified to autoselect the first option.
// Better UX for case when you aren't adding new tags, only selecting from list.
const ReactTags = require("react-tag-autocomplete")

@observer
class EditTags extends React.Component<{
    tags: Tag[]
    suggestions: Tag[]
    onDelete: (index: number) => void
    onAdd: (tag: Tag) => void
    onSave: () => void
}> {
    dismissable: boolean = true

    @action.bound onClickSomewhere(e: MouseEvent) {
        if (this.dismissable) this.props.onSave()
        this.dismissable = true
    }

    @action.bound onClick() {
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
                    handleAddition={this.props.onAdd}
                    handleDelete={this.props.onDelete}
                    minQueryLength={1}
                />
            </div>
        )
    }
}

@observer
export class EditableTags extends React.Component<{
    tags: Tag[]
    suggestions: Tag[]
    onSave: (tags: Tag[]) => void
    disabled?: boolean
}> {
    @observable isEditing: boolean = false
    base: React.RefObject<HTMLDivElement> = React.createRef()

    @observable tags: Tag[] = _.clone(this.props.tags)

    @action.bound onAddTag(tag: Tag) {
        this.tags.push(tag)
        this.tags = _.uniqBy(this.tags, t => t.id).filter(
            t => t.name !== "Uncategorized"
        )

        this.ensureUncategorized()
    }

    @action.bound onRemoveTag(index: number) {
        this.tags.splice(index, 1)
        this.ensureUncategorized()
    }

    @action.bound ensureUncategorized() {
        if (this.tags.length === 0) {
            const uncategorized = this.props.suggestions.find(
                t => t.name === "Uncategorized"
            )
            if (uncategorized) this.tags.push(uncategorized)
        }
    }

    @action.bound onToggleEdit() {
        if (this.isEditing) {
            this.props.onSave(this.tags.filter(t => t.name !== "Uncategorized"))
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
        const { disabled } = this.props
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
                        {tags.map(t => (
                            <TagBadge key={t.id} tag={t} />
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
