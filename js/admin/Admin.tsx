import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as _ from 'lodash'
import {observable, computed} from 'mobx'
import * as urljoin from 'url-join'

import AdminApp from './AdminApp'
import { Json, queryParamsToStr } from '../charts/Util'

type HTTPMethod = 'GET'|'PUT'|'POST'|'DELETE'

interface ClientSettings {
    ENV: 'development'|'production'
    GITHUB_USERNAME: string
}

// Entry point for the grapher admin
// Currently just the editor, but eventually should expand to cover everything
export default class Admin {
    @observable errorMessage?: { title: string, content: string, isFatal?: boolean }
    grapherRoot: string
    basePath: string
    username: string
    settings: ClientSettings

    // The special "uncategorized" tag that represents all things without a tag
    uncategorizedTag = { name: "Uncategorized", id: 375 }

    constructor(rootUrl: string, username: string, settings: ClientSettings) {
        this.grapherRoot = rootUrl
        this.basePath = "/admin"
        this.username = username
        this.settings = settings
    }

    @observable currentRequests: Promise<Response>[] = []

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
    async rawRequest(path: string, data: string|File, method: HTTPMethod) {
        const headers: any = {}
        const isFile = data instanceof File
        if (!isFile) {
            headers['Content-Type'] = 'application/json'
        }
        headers['Accept'] = 'application/json'

        return fetch(this.url(path), {
            method: method,
            credentials: 'same-origin',
            headers: headers,
            body: method !== 'GET' ? data : undefined
        })
    }

    // Make a request and expect JSON
    // If we can't retrieve and parse JSON, it is treated as a fatal/unexpected error
    async requestJSON(path: string, data: Json|File, method: HTTPMethod, opts: { onFailure?: 'show'|'continue' } = {}) {
        const onFailure = opts.onFailure || 'show'

        let targetPath = path
        // Tack params on the end if it's a GET request
        if (method === "GET" && !_.isEmpty(data)) {
            targetPath += queryParamsToStr(data as Json)
        }

        let response: Response|undefined
        let text: string|undefined
        let json: Json

        let request: Promise<Response>
        try {
            request = this.rawRequest(targetPath, data instanceof File ? data : JSON.stringify(data), method)
            this.currentRequests.push(request)

            response = await request
            text = await response.text()

            json = JSON.parse(text)
            if (json.error) {
                if (onFailure === 'show') {
                    this.errorMessage = { title: `Failed to ${method} ${targetPath} (${response.status})`, content: json.error.message, isFatal: response.status !== 404 }
                } else if (onFailure !== 'continue') {
                    throw json.error
                }
            }
        } catch (err) {
            this.errorMessage = { title: `Failed to ${method} ${targetPath}` + (response ? ` (${response.status})` : ""), content: text||err, isFatal: true }
            throw this.errorMessage
        } finally {
            this.currentRequests = this.currentRequests.filter(req => req !== request)
        }

        return json
    }

    async getJSON(path: string, params: Json = {}): Promise<Json> {
        return this.requestJSON(path, params, 'GET')
    }
}
