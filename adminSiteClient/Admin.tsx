import * as Sentry from "@sentry/react"
import * as lodash from "lodash-es"
import { observable, computed, action, makeObservable } from "mobx"
import urljoin from "url-join"

import { AdminApp } from "./AdminApp.js"
import {
    Json,
    JsonError,
    stringifyUnknownError,
    queryParamsToStr,
} from "@ourworldindata/utils"
import { createRoot } from "react-dom/client"

type HTTPMethod = "GET" | "PUT" | "POST" | "DELETE" | "PATCH"

interface ClientSettings {
    ENV: "development" | "production"
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
    errorMessage: ErrorMessage | undefined = undefined
    basePath: string
    username: string
    email: string
    isSuperuser: boolean
    settings: ClientSettings

    constructor(props: {
        username: string
        email: string
        isSuperuser: boolean
        settings: ClientSettings
    }) {
        makeObservable(this, {
            errorMessage: observable,
            currentRequests: observable,
            loadingIndicatorSetting: observable,
        })
        this.basePath = "/admin"
        this.username = props.username
        this.email = props.email
        this.isSuperuser = props.isSuperuser
        this.settings = props.settings

        Sentry.setUser({
            username: this.username,
            email: this.email,
        })
    }

    currentRequests: Promise<Response>[] = []

    @computed get showLoadingIndicator(): boolean {
        return this.loadingIndicatorSetting === "default"
            ? this.currentRequests.length > 0
            : this.loadingIndicatorSetting === "loading"
    }

    loadingIndicatorSetting: "loading" | "off" | "default" = "default"

    start(containerNode: HTMLElement): void {
        const root = createRoot(containerNode)
        root.render(<AdminApp admin={this} />)
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
        data: string | File | undefined | FormData,
        method: HTTPMethod,
        abortController?: AbortController,
        credentials: RequestCredentials = "same-origin"
    ): Promise<Response> {
        const headers: HeadersInit = {}
        const isFile = data instanceof File || data instanceof FormData
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
        data: Json | File | FormData,
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
                data instanceof File || data instanceof FormData
                    ? data
                    : JSON.stringify(data),
                method,
                abortController
            )
            this.addRequest(request)

            response = await request
            text = await response.text()

            json = JSON.parse(text)
            if (json.error) {
                throw new JsonError(json.error.message, json.error.status)
            }
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
