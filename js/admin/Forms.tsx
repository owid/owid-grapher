/* Forms.tsx
 * ================
 *
 * Reusable React components to keep admin form code succint and consistent
 */

import * as React from 'react'
import {toString, numberOnly, pick} from '../charts/Util'
import {bind} from 'decko'

export interface TextFieldProps extends React.HTMLAttributes<HTMLLabelElement> {
    label?: string,
    value: string|undefined,
    onValue: (value: string|undefined) => void,
    onEnter?: () => void,
    onEscape?: () => void,
    placeholder?: string,
    title?: string,
    disabled?: boolean
}

export class TextField extends React.Component<TextFieldProps> {
    @bind onInput(ev: React.FormEvent<HTMLInputElement>) {
        const value = ev.currentTarget.value
        if (value == "") {
            this.props.onValue(undefined)
        } else {
            this.props.onValue(value)
        }
    }

    @bind onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
        if (ev.key == "Enter" && this.props.onEnter) {
            this.props.onEnter()
        } else if (ev.key == "Escape" && this.props.onEscape) {
            this.props.onEscape()
        }
    }

    render() {
        const {props} = this
        const passthroughProps = pick(props, ['placeholder', 'title', 'disabled'])

        if (props.label) {
            return <label className="TextField" style={props.style}>
                {props.label}
                <input className="form-control" type="text" value={props.value} onInput={this.onInput} onKeyDown={this.onKeyDown} {...passthroughProps}/>
            </label>    
        } else {
            return <input style={props.style} className="TextField form-control" type="text" value={props.value} onInput={this.onInput} onKeyDown={this.onKeyDown} {...passthroughProps}/>
        }
    }
}

export class TextAreaField extends React.Component<TextFieldProps> {
   @bind onInput(ev: React.FormEvent<HTMLTextAreaElement>) {
        const value = ev.currentTarget.value
        if (value == "") {
            this.props.onValue(undefined)
        } else {
            this.props.onValue(value)
        }
    }

    render() {
        const {props} = this
        const passthroughProps = pick(props, ['placeholder', 'title', 'disabled'])

        if (props.label) {
            return <label style={props.style} className="TextAreaField">
                {props.label}
                <textarea className="form-control" value={props.value} onInput={this.onInput} {...passthroughProps}/>
            </label>    
        } else {
            return <textarea className="TextAreaField form-control" style={props.style} value={props.value} onInput={this.onInput} {...passthroughProps}/>
        }
    }
}

export interface NumberFieldProps {
    label?: string,
    value: number|undefined,
    onValue: (value: number|undefined) => void,
    min?: number,
    max?: number,
    placeholder?: string
    disabled?: boolean
}

export class NumberField extends React.Component<NumberFieldProps> {
    render() {
        const {props} = this
        const passthroughProps = pick(props, ['min', 'max', 'placeholder', 'disabled'])
        if (props.label) {
            return <label className="NumberField">
                {props.label} <input type="text" value={toString(props.value)} onChange={(ev) => props.onValue(numberOnly(ev.currentTarget.value))} {...passthroughProps}/>
            </label>
        } else {
            return <input className="NumberField" type="text" value={toString(props.value)} onChange={(ev) => props.onValue(numberOnly(ev.currentTarget.value))} {...passthroughProps}/>
        }
    }
}

export interface SelectFieldProps {
    label: string,
    value: string|undefined,
    onValue: (value: string|undefined) => void,
    options: string[],
    optionLabels?: string[]
}

export class SelectField extends React.Component<SelectFieldProps> {
    render() {
        const {props} = this
        return <label>
            {props.label}
            <select className="form-control" value={toString(props.value)} onChange={(ev: React.FormEvent<HTMLSelectElement>) => props.onValue(ev.currentTarget.value.length == 0 ? undefined : ev.currentTarget.value)}>
                {props.options.map((value, i) => 
                    <option value={value}>{props.optionLabels ? props.optionLabels[i] : value}</option>
                )}
            </select>
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
        const {props} = this
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
    render() {
        const {props} = this
        return <label className="Toggle clickable">
            <input type="checkbox" checked={props.value} onChange={(ev) => props.onValue(ev.target.checked)}/>
            {" " + props.label}
        </label>    
    }
}