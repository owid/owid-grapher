import * as React from 'react'
import * as ReactDOM from 'react-dom'
import AdminApp from './AdminApp'
import {observable, computed} from 'mobx'
import * as urljoin from 'url-join'

// Entry point for the grapher admin
// Currently just the editor, but eventually should expand to cover everything
export default class Admin {
    grapherRoot: string
    basePath: string
    cacheTag: string
    username: string
    constructor(rootUrl: string, cacheTag: string, username: string) {
        this.grapherRoot = rootUrl
        this.basePath = "/grapher/admin"
        this.cacheTag = cacheTag
        this.username = username
    }

    @observable currentRequests: Promise<any>[] = []

    @computed get isLoading() {
        return this.currentRequests.length > 0
    }

    start(containerNode: HTMLElement) {
        ReactDOM.render(<AdminApp admin={this}/>, containerNode)
    }

    url(path: string): string {
        return urljoin(this.basePath, path)
    }

    get csrfToken() {
        const meta = document.querySelector("[name=_token]")
        if (!meta)
            throw new Error("Could not find csrf token")
        return meta.getAttribute("value")
    }

    async getJSON(path: string): Promise<any> {
        try {
            const request = this.request(path, {}, 'GET')
            this.currentRequests.push(request)

            const response = await request
            if (!response.ok) {
                const errorMessage = await response.text()
                throw errorMessage
            }

            const json = response.json()
            this.currentRequests.pop()
            return json
        } catch (err) {
            this.currentRequests.pop()
            throw err
        }
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
