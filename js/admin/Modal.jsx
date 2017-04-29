/* Modal.jsx
 * ================
 *
 * Because react-modal doesn't work so well with Preact.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-04-29
 */

// @flow

import * as _ from 'underscore'
import React, {Component} from 'react'
import {observable, computed} from 'mobx'
import {observer} from 'mobx-react'
import {render} from 'preact'

const modalStyle = {
  position: 'fixed',
  top: '40px',
  left: '40px',
  right: '40px',
  bottom: '40px',
  border: '1px solid #ccc',
  background: '#fff',
  overflow: 'auto',
  WebkitOverflowScrolling: 'touch',
  borderRadius: '4px',
  outline: 'none',
  padding: '20px',
  "z-index": "2000"
}

export default class Modal extends Component {
    componentDidMount() {
        this.componentDidUpdate()
    }

    componentDidUpdate() {
        const {props, rootNode} = this
        const parent = props.parentSelector()

        if (props.isOpen) {
            this.rootNode = render(<div style={modalStyle}>{this.props.children}</div>, parent, rootNode)
        } else {
            this.rootNode = render('', parent, rootNode)
        }
    }
}
