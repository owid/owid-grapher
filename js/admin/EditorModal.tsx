// Because react-modal doesn't work so well with Preact.

import * as React from 'react'
import * as ReactDOM from 'react-dom'

export default class EditorModal extends React.Component<{ children: any }> {
    modalContainer: HTMLDivElement

    componentDidMount() {
        const modalContainer = document.createElement('div')
        modalContainer.className = "modalContainer"
        document.body.appendChild(modalContainer)
        this.modalContainer = modalContainer

        this.componentDidUpdate()
    }

    componentWillUnmount() {
        document.body.removeChild(this.modalContainer)
    }

    componentDidUpdate() {
        ReactDOM.render(this.props.children, this.modalContainer)
    }
}
