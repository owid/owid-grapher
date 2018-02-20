import * as React from 'react'
import * as ReactDOM from 'react-dom'
import AdminApp from './AdminApp'
import {observable, computed} from 'mobx'
import * as urljoin from 'url-join'
import {extend} from '../charts/Util'

type HTTPMethod = 'GET'|'PUT'|'POST'|'DELETE'

// Entry point for the grapher admin
// Currently just the editor, but eventually should expand to cover everything
export default class Admin {
    @observable errorMessage?: { title: string, content: string, isFatal?: true }
    grapherRoot: string
    basePath: string
    username: string
    constructor(rootUrl: string, username: string) {
        this.grapherRoot = rootUrl
        this.basePath = "/admin"
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

    goto(path: string) {
        this.url(path)
    }

    // Make a request with no error or response handling
    async rawRequest(path: string, data: any, method: HTTPMethod) {
        return fetch(this.url(path), {
            method: method,
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: method !== 'GET' ? JSON.stringify(data) : undefined
        })
    }

    // Make a request and expect JSON in response
    // If we can't retrieve and parse JSON, it is treated as a fatal/unexpected error
    async requestJSON(path: string, data: any, method: HTTPMethod, opts: { onFailure?: 'show'|'continue' } = {}) {
        const onFailure = opts.onFailure || 'show'

        let response: Response|undefined
        let text: string|undefined
        let json: any

        try {
            const request = this.rawRequest(path, data, method)
            this.currentRequests.push(request)

            response = await request
            text = await response.text()

            json = JSON.parse(text)
            if (json.error) {
                if (onFailure === 'show') {
                    this.errorMessage = { title: `Failed to ${method} ${path} (${response.status})`, content: json.error.message }
                } else if (onFailure !== 'continue') {
                    throw json.error
                }
            }
        } catch (err) {
            this.errorMessage = { title: `Failed to ${method} ${path}` + (response ? ` (${response.status})` : ""), content: text||err, isFatal: true }
            throw this.errorMessage
        } finally {
            this.currentRequests.pop()
        }

        return json
    }

    async getJSON(path: string): Promise<any> {
        return this.requestJSON(path, {}, 'GET')
    }

    /*async request(path: string, data: any, method: 'GET' | 'PUT' | 'POST') {
        try {
            const request = this.rawRequest(path, data, method)
            this.currentRequests.push(request)
            const response = await request
            this.currentRequests.pop()
        } catch (err) {
            this.currentRequests.pop()
            this.errorMessage = { title: `Failed to ${method} ${path}`, content: err }
            throw this.errorMessage
        }
    }*/
}
