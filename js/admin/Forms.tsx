/* Forms.tsx
 * ================
 *
 * Reusable React components to keep admin form code succint and consistent
 */

import * as React from 'react'
import {toString} from 'lodash'
import {numberOnly} from '../charts/Util'
import * as _ from 'lodash'
import {bind} from 'decko'

export interface TextFieldProps {
    label?: string,
    value: string|undefined,
    onValue: (value: string|undefined) => void,
    placeholder?: string,
    disabled?: boolean
}

export class TextField extends React.Component<TextFieldProps, undefined> {
    @bind onChange(ev: React.FormEvent<HTMLInputElement>) {
        const value = ev.currentTarget.value
        if (value == "") {
            this.props.onValue(undefined)
        } else {
            this.props.onValue(value)
        }
    }

    render() {
        const {props} = this
        return <label>
            {props.label}
            <input className="form-control" type="text" value={props.value} onChange={this.onChange} {..._.pick(props, ['placeholder', 'disabled'])}/>
        </label>    
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

export class NumberField extends React.Component<NumberFieldProps, undefined> {
    render() {
        const {props} = this
        const input = <input type="number" value={toString(props.value)} onChange={(ev) => props.onValue(numberOnly(ev.currentTarget.value))} {..._.pick(props, ['min', 'max', 'placeholder', 'disabled'])}/>

        if (props.label) {
            return <label>{props.label} {input}</label>
        } else {
            return input
        }
    }
}

export interface SelectFieldProps {
    label: string,
    value: string|undefined,
    onValue: (value: string) => void,
    options: string[]
}

export class SelectField extends React.Component<SelectFieldProps, undefined> {
    render() {
        const {props} = this
        return <label>
            {props.label}
            <select className="form-control" value={toString(props.value)} onChange={(ev: React.FormEvent<HTMLSelectElement>) => props.onValue(ev.currentTarget.value.length == 0 ? undefined : ev.currentTarget.value)}>
                {props.options.map(value => 
                    <option value={value}>{value}</option>
                )}
            </select>
        </label>    
    }
}

export interface NumericSelectFieldProps {
    label?: string,
    value: number,
    onValue: (value: number) => void,
    options: number[],
    optionLabels: string[]
}

export class NumericSelectField extends React.Component<NumericSelectFieldProps, undefined> {
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

export class Toggle extends React.Component<ToggleProps, undefined> {
    render() {
        const {props} = this
        return <label className="clickable">
            <input type="checkbox" checked={props.value} onChange={(ev) => props.onValue(ev.target.checked)}/>
            {" " + props.label}
        </label>    
    }
}