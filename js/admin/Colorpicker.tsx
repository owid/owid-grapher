import * as React from 'react'
import * as _ from 'lodash'
import Color from '../charts/Color'
import {bind} from 'decko'
import ColorBinder from '../charts/ColorBinder'

export default class Colorpicker extends React.Component<{ color: Color, onColor: (color: Color) => void, onClose: () => void }, undefined> {
    @bind onCloseButton(ev: React.MouseEvent<HTMLAnchorElement>) {
        this.props.onClose()
        ev.stopPropagation()
    }

    render() {
        const availableColors: Color[] = ColorBinder.basicScheme

        return <div className="popup-picker-wrapper" tabIndex={0} onBlur={() => console.log("blur")}>
            <a href='#' className='close-btn pull-right' onClick={this.onCloseButton}>
                <i className='fa fa-times'></i>
            </a>
            <ul className='no-bullets'>
                {_.map(availableColors, color => 
                    <li style={{backgroundColor: color}} onClick={() => this.props.onColor(color)}/>
                )}
            </ul>
            <input style={{width: "100%"}} className="hex-color" title="RGB hex color code" type="text" value={this.props.color}/>
        </div>
    }
}