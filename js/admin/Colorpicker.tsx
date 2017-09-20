import * as React from 'react'
import {last} from '../charts/Util'
import Color from '../charts/Color'
import {TextField} from './Forms'
import ColorSchemes from '../charts/ColorSchemes'

export interface ColorpickerProps {
    color?: Color
    onColor: (color: Color|undefined) => void
    onClose: () => void 
}

export default class Colorpicker extends React.Component<ColorpickerProps> {
    base: HTMLDivElement

    componentDidMount() {
        const textField = this.base.querySelector("input") as HTMLInputElement
        textField.focus()
    }
    

    render() {
        const availableColors: Color[] = last(ColorSchemes['owid-distinct'].colorSets) as Color[]

        return <div className="popup-picker-wrapper" tabIndex={0} onClick={e => e.stopPropagation()}>
            <a href='#' className='close-btn pull-right' onClick={this.props.onClose}>
                <i className='fa fa-times' style={{color: 'white'}}></i>
            </a>
            <ul className='no-bullets'>
                {availableColors.map(color => 
                    <li style={{backgroundColor: color}} onClick={() => { this.props.onColor(color); this.props.onClose() }}/>
                )}
            </ul>
            <TextField placeholder="#xxxxxx" value={this.props.color} onValue={this.props.onColor} onEnter={this.props.onClose} onEscape={this.props.onClose}/>
        </div>
    }
}