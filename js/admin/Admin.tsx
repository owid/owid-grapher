import * as React from 'react'
import * as ReactDOM from 'react-dom'
import AdminApp from './AdminApp'
import {observable} from 'mobx'

// Entry point for the grapher admin
// Currently just the editor, but eventually should expand to cover everything
export default class Admin {
    rootUrl: string
    cacheTag: string
    @observable.ref currentPath: string
    constructor(rootUrl: string, cacheTag: string) {
        this.rootUrl = rootUrl
        this.cacheTag = cacheTag
    }

    start(containerNode: HTMLElement) {
        this.currentPath = window.location.pathname.split("/grapher/admin")[1]

        ReactDOM.render(<AdminApp admin={this}/>, containerNode)
    }

    url(path: string): string {
        return this.rootUrl + path
    }

    get csrfToken() {
        const meta = document.querySelector("[name=_token]")
        if (!meta)
            throw new Error("Could not find csrf token")
        return meta.getAttribute("value")
    }

    fetchJSON(path: string) {
        return fetch(this.url(path), { credentials: 'same-origin' }).then(data => data.json())
    }

    get(path: string) {
        return this.request(path, {}, 'GET')
    }

    request(path: string, data: any, method: 'GET' | 'PUT' | 'POST') {
        return fetch(this.url(path), {
            method: method,
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRFToken': this.csrfToken
            },
            body: method !== 'GET' ? JSON.stringify(data) : undefined
        })
    }
}
