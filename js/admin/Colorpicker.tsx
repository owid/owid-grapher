import * as React from 'react'
import * as _ from 'lodash'
import Color from '../charts/Color'
import {bind} from 'decko'
import ColorBinder from '../charts/ColorBinder'
import {observable} from 'mobx'
import {TextField} from './Forms'

export interface ColorpickerProps {
    color: Color
    onColor: (color: Color|undefined) => void
    onClose: () => void 
}

export default class Colorpicker extends React.Component<ColorpickerProps, undefined> {
    base: HTMLDivElement

    render() {
        const availableColors: Color[] = ColorBinder.basicScheme

        return <div className="popup-picker-wrapper" tabIndex={0} onClick={e => e.stopPropagation()}>
            <a href='#' className='close-btn pull-right' onClick={this.props.onClose}>
                <i className='fa fa-times' style={{color: 'white'}}></i>
            </a>
            <ul className='no-bullets'>
                {_.map(availableColors, color => 
                    <li style={{backgroundColor: color}} onClick={() => { this.props.onColor(color); this.props.onClose() }}/>
                )}
            </ul>
            <TextField placeholder="#xxxxxx" value={this.props.color} onValue={this.props.onColor}/>
        </div>
    }
}