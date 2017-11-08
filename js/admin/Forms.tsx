/* Forms.tsx
 * ================
 *
 * Reusable React components to keep admin form code succint and consistent
 */

import * as React from 'react'
import { toString, numberOnly, pick, guid } from '../charts/Util'
import { bind } from 'decko'

const Select = require('preact-material-components/Select').default
const MDTextField = require('preact-material-components/TextField').default

const MDCTextfield = require('@material/textfield').MDCTextfield
const MDCCheckbox = require('@material/checkbox').MDCCheckbox

export interface TextFieldProps extends React.HTMLAttributes<HTMLLabelElement> {
    label?: string,
    value: string | undefined,
    onValue: (value: string | undefined) => void,
    onEnter?: () => void,
    onEscape?: () => void,
    placeholder?: string,
    title?: string,
    disabled?: boolean,
    helpText?: string,
    fullWidth?: boolean
}

export class TextField extends React.Component<TextFieldProps> {
    @bind onInput(ev: React.FormEvent<HTMLInputElement>) {
        const value = ev.currentTarget.value
        if (value === "") {
            this.props.onValue(undefined)
        } else {
            this.props.onValue(value)
        }
    }

    @bind onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
        if (ev.key === "Enter" && this.props.onEnter) {
            this.props.onEnter()
        } else if (ev.key === "Escape" && this.props.onEscape) {
            this.props.onEscape()
        }
    }

    id: string
    componentWillMount() {
        this.id = `textfield-${guid()}`
    }

    base: HTMLDivElement
    textfield: any
    componentDidMount() {
        this.textfield = new MDCTextfield(this.base.querySelector(".mdc-textfield"))
    }

    componentDidUpdate() {
        const input = this.base.querySelector("input") as HTMLInputElement
        input.dispatchEvent(new Event("focus"))
    }

    render() {
        const { props } = this
        const passthroughProps = pick(props, ['style', 'title', 'disabled'])

        return <div style={{display: "inline-block"}}>
            <div className="mdc-textfield" {...passthroughProps}>
                <input type="text" id={this.id} className="mdc-textfield__input" onInput={this.onInput} value={props.value}/>
                <label htmlFor={this.id} className="mdc-textfield__label">{props.label}</label>
                <div className="mdc-textfield__bottom-line"></div>
            </div>
            {props.helpText && <p id={`${this.id}-helptext`} className="mdc-textfield-helptext mdc-textfield-helptext--persistent" aria-hidden={true}>
                {props.helpText}
            </p>}
        </div>

        //return <MDTextField label={props.label} value={props.value} onInput={this.onInput} placeholder={props.placeholder} {...passthroughProps} />
        /*if (props.label) {
            return <label className="TextField" style={props.style}>
                {props.label}
                <input className="form-control" type="text" value={props.value} onInput={this.onInput} onKeyDown={this.onKeyDown} {...passthroughProps} />
            </label>
        } else {
            return <input style={props.style} className="TextField form-control" type="text" value={props.value} onInput={this.onInput} onKeyDown={this.onKeyDown} {...passthroughProps} />
        }*/
    }
}

export class TextAreaField extends React.Component<TextFieldProps> {
    @bind onInput(ev: React.FormEvent<HTMLTextAreaElement>) {
        const value = ev.currentTarget.value
        if (value === "") {
            this.props.onValue(undefined)
        } else {
            this.props.onValue(value)
        }
    }

    base: HTMLDivElement
    componentDidMount() {
        MDCTextfield.attachTo(this.base)
    }

    render() {
        const { props } = this
        const passthroughProps = pick(props, ['placeholder', 'title', 'disabled', 'label', 'helpText'])


        return <div className="mdc-textfield mdc-textfield--textarea">
            <textarea id="textarea" className="mdc-textfield__input" rows={8} cols={40} value={props.value} onInput={this.onInput}></textarea>
            <label htmlFor="textarea" className="mdc-textfield__label">{props.label}</label>
        </div>
        //return <MDTextField fullwidth={true} value={props.value} onInput={this.onInput} {...passthroughProps}/>
        /*if (props.label) {
            return <label style={props.style} className="TextAreaField">
                {props.label}
                <textarea className="form-control" value={props.value} onInput={this.onInput} {...passthroughProps} />
            </label>
        } else {
            return <textarea className="TextAreaField form-control" style={props.style} value={props.value} onInput={this.onInput} {...passthroughProps} />
        }*/
    }
}

export interface NumberFieldProps {
    label?: string,
    value: number | undefined,
    onValue: (value: number | undefined) => void,
    min?: number,
    max?: number,
    placeholder?: string
    disabled?: boolean
}

export class NumberField extends React.Component<NumberFieldProps> {
    render() {
        const { props } = this
        const passthroughProps = pick(props, ['min', 'max', 'placeholder', 'disabled'])
        if (props.label) {
            return <label className="NumberField">
                {props.label} <input type="text" value={toString(props.value)} onChange={(ev) => props.onValue(numberOnly(ev.currentTarget.value))} {...passthroughProps} />
            </label>
        } else {
            return <input className="NumberField" type="text" value={toString(props.value)} onChange={(ev) => props.onValue(numberOnly(ev.currentTarget.value))} {...passthroughProps} />
        }
    }
}

export interface SelectFieldProps {
    label: string,
    value: string | undefined,
    onValue: (value: string | undefined) => void,
    options: string[],
    optionLabels?: string[]
}

export class SelectField extends React.Component<SelectFieldProps> {
    render() {
        const { props } = this
        return <label>
            {props.label}
            <Select selectedIndex={props.value ? props.options.indexOf(props.value) : undefined} onChange={(e: any) => props.onValue(props.options[e.selectedIndex])}>
                {props.options.map((value, i) =>
                    <Select.Item>{props.optionLabels ? props.optionLabels[i] : value}</Select.Item>
                )}
            </Select>
        </label>
    }
}

export interface NumericSelectFieldProps {
    label?: string,
    value?: number,
    onValue: (value: number) => void,
    options: number[],
    optionLabels: string[]
}

export class NumericSelectField extends React.Component<NumericSelectFieldProps> {
    onChange(ev: React.FormEvent<HTMLSelectElement>) {
        this.props.onValue(parseFloat(ev.currentTarget.value))
    }

    render() {
        const { props } = this
        return <label>
            {props.label}
            <select className="form-control" value={props.value}>
                {props.options.map((value, i) =>
                    <option value={value}>{props.optionLabels[i]}</option>
                )}
            </select>
        </label>
    }
}

export interface ToggleProps {
    label: string,
    value: boolean,
    onValue: (value: boolean) => void
}

export class Toggle extends React.Component<ToggleProps> {
    base: HTMLDivElement
    checkbox: any
    componentDidMount() {
        this.checkbox = new MDCCheckbox(this.base)
    }

    componentDidUpdate() {
        this.checkbox.checked = this.props.value
    }

    render() {
        const { props } = this
        /*return <div className="mdc-form-field">

        </div>*/

        return <div className="mdc-form-field">
            <div className="mdc-checkbox">
                <input type="checkbox"
                    className="mdc-checkbox__native-control"
                    onChange={(ev) => props.onValue(ev.target.checked)} />
                <div className="mdc-checkbox__background">
                    <svg className="mdc-checkbox__checkmark"
                        viewBox="0 0 24 24">
                        <path className="mdc-checkbox__checkmark__path"
                            fill="none"
                            stroke="white"
                            d="M1.73,12.91 8.1,19.28 22.79,4.59" />
                    </svg>
                    <div className="mdc-checkbox__mixedmark"></div>
                </div>
            </div>

            <label>{props.label}</label>
        </div>
        /* return <FormField>
             <Checkbox checked={props.value} onChange={(ev) => props.onValue(ev.target.checked)}/> <label>{props.label}</label>
         </FormField>
         return <label className="Toggle clickable">
             <input type="checkbox" checked={props.value}  />
             {" " + props.label}
         </label>*/
    }
}
