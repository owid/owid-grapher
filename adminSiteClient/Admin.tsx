import ReactDOM from "react-dom"
import * as lodash from "lodash"
import { observable, computed, action } from "mobx"
import urljoin from "url-join"

import { AdminApp } from "./AdminApp.js"
import {
    Json,
    stringifyUnknownError,
    queryParamsToStr,
} from "@ourworldindata/utils"

type HTTPMethod = "GET" | "PUT" | "POST" | "DELETE" | "PATCH"

interface ClientSettings {
    ENV: "development" | "production"
    GITHUB_USERNAME: string
    DATA_API_FOR_ADMIN_UI?: string
}

interface ErrorMessage {
    title: string
    content: string
    isFatal?: boolean
}

// Entry point for the grapher admin
// Currently just the editor, but eventually should expand to cover everything
export class Admin {
    @observable errorMessage?: ErrorMessage
    basePath: string
    username: string
    isSuperuser: boolean
    settings: ClientSettings

    constructor(props: {
        username: string
        isSuperuser: boolean
        settings: ClientSettings
    }) {
        this.basePath = "/admin"
        this.username = props.username
        this.isSuperuser = props.isSuperuser
        this.settings = props.settings
    }

    @observable currentRequests: Promise<Response>[] = []

    @computed get showLoadingIndicator(): boolean {
        return this.loadingIndicatorSetting === "default"
            ? this.currentRequests.length > 0
            : this.loadingIndicatorSetting === "loading"
    }

    @observable loadingIndicatorSetting: "loading" | "off" | "default" =
        "default"

    start(containerNode: HTMLElement, gitCmsBranchName: string): void {
        ReactDOM.render(
            <AdminApp admin={this} gitCmsBranchName={gitCmsBranchName} />,
            containerNode
        )
    }

    url(path: string): string {
        return urljoin(this.basePath, path)
    }

    goto(path: string): void {
        this.url(path)
    }

    // Make a request with no error or response handling
    async rawRequest(
        path: string,
        data: string | File | undefined,
        method: HTTPMethod,
        abortController?: AbortController,
        credentials: RequestCredentials = "same-origin"
    ): Promise<Response> {
        const headers: HeadersInit = {}
        const isFile = data instanceof File
        if (!isFile) {
            headers["Content-Type"] = "application/json"
        }
        headers["Accept"] = "application/json"

        const fetchUrl = path.startsWith("http") ? path : this.url(path)

        return fetch(fetchUrl, {
            method: method,
            credentials: credentials,
            headers: headers,
            body: method !== "GET" ? data : undefined,
            signal: abortController?.signal,
        })
    }

    // Make a request and expect JSON
    // If we can't retrieve and parse JSON, it is treated as a fatal/unexpected error
    async requestJSON<T extends Json = Json>(
        path: string,
        data: Json | File,
        method: HTTPMethod,
        opts: { onFailure?: "show" | "continue" } = {}
    ): Promise<T> {
        const onFailure = opts.onFailure || "show"

        let targetPath = path
        // Tack params on the end if it's a GET request
        if (method === "GET" && !lodash.isEmpty(data)) {
            targetPath += queryParamsToStr(data as Json)
        }

        let response: Response | undefined
        let text: string | undefined
        let json: T
        const abortController = new AbortController()

        let request: Promise<Response> | undefined
        try {
            request = this.rawRequest(
                targetPath,
                data instanceof File ? data : JSON.stringify(data),
                method,
                abortController
            )
            this.addRequest(request)

            response = await request
            text = await response.text()

            json = JSON.parse(text)
            if (json.error) throw json.error
        } catch (err) {
            if (onFailure === "show")
                this.setErrorMessage({
                    title:
                        `Failed to ${method} ${targetPath}` +
                        (response ? ` (${response.status})` : ""),
                    content:
                        (stringifyUnknownError(err) || text) ??
                        "unexpected error value in setErrorMessage",
                    isFatal: response?.status !== 404,
                })
            throw err
        } finally {
            if (request) {
                this.removeRequest(request)
            }
        }

        return json
    }

    @action.bound setErrorMessage(message: ErrorMessage): void {
        this.errorMessage = message
    }

    @action.bound private addRequest(request: Promise<Response>): void {
        this.currentRequests.push(request)
    }

    @action.bound private removeRequest(request: Promise<Response>): void {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.currentRequests = this.currentRequests.filter(
            (req) => req !== request
        )
    }

    async getJSON<T extends Json = Json>(
        path: string,
        params: Json = {}
    ): Promise<T> {
        return this.requestJSON<T>(path, params, "GET")
    }
}
