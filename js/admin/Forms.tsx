/* Forms.tsx
 * ================
 *
 * Reusable React components to keep admin form code succint and consistent
 */

import * as React from 'react'
import {toString} from 'lodash'
import {numberOrNull} from '../charts/Util'

export interface TextFieldProps {
    label: string,
    value: string,
    onValue: (value: string) => void
}

export class TextField extends React.Component<TextFieldProps, undefined> {
    render() {
        const {props} = this
        return <label>
            {props.label}
            <input className="form-control" type="text" value={props.value} onChange={(ev) => props.onValue(ev.currentTarget.value)}/>
        </label>    
    }
}

export interface NumberFieldProps {
    label: string,
    value: number|null,
    onValue: (value: number|null) => void
}

export class NumberField extends React.Component<NumberFieldProps, undefined> {
    render() {
        const {props} = this
        return <label>
            {props.label}
            <input className="form-control" type="number" value={toString(props.value)} onChange={(ev) => props.onValue(numberOrNull(ev.currentTarget.value))}/>
        </label>    
    }
}

export interface SelectFieldProps {
    label: string,
    value: string,
    onValue: (value: string) => void,
    options: string[]
}

export class SelectField extends React.Component<SelectFieldProps, undefined> {
    render() {
        const {props} = this
        return <label>
            {props.label}
            <select className="form-control" value={toString(props.value)} onChange={(ev) => props.onValue(ev.currentTarget.value)}>
                {props.options.map(value => 
                    <option value={value}>{value}</option>
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
        return <label>
            <input type="checkbox" checked={props.value} onChange={(ev) => props.onValue(ev.target.checked)}/>
            {" " + props.label}
        </label>    
    }
}