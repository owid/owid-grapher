import * as React from 'react'
import * as ReactDOM from 'react-dom'
import AdminApp from './AdminApp'
import {observable} from 'mobx'

// Entry point for the grapher admin
// Currently just the editor, but eventually should expand to cover everything
export default class Admin {
    rootUrl: string
    cacheTag: string
    username: string
    @observable.ref currentPath: string
    constructor(rootUrl: string, cacheTag: string, username: string) {
        this.rootUrl = rootUrl
        this.cacheTag = cacheTag
        this.username = username
    }

    start(containerNode: HTMLElement) {
        this.currentPath = window.location.pathname.split("/grapher/admin")[1]

        ReactDOM.render(<AdminApp admin={this}/>, containerNode)
    }

    url(path: string): string {
        return this.rootUrl + '/admin/' + path
    }

    get csrfToken() {
        const meta = document.querySelector("[name=_token]")
        if (!meta)
            throw new Error("Could not find csrf token")
        return meta.getAttribute("value")
    }

    async getJSON(path: string): Promise<any> {
        const response = await this.request(path, {}, 'GET')
        if (!response.ok) {
            const errorMessage = await response.text()
            throw errorMessage
        }
        return response.json()
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
                'X-CSRFToken': this.csrfToken as string
            },
            body: method !== 'GET' ? JSON.stringify(data) : undefined
        })
    }
}
