import React from "react"
import ReactDOM from "react-dom"
import * as lodash from "lodash"
import { observable, computed, action, makeObservable } from "mobx";
import urljoin from "url-join"

import { AdminApp } from "./AdminApp.js"
import { Json, stringifyUnkownError } from "../clientUtils/Util.js"
import { queryParamsToStr } from "../clientUtils/urls/UrlUtils.js"

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
    errorMessage?: ErrorMessage;
    basePath: string
    username: string
    isSuperuser: boolean
    settings: ClientSettings

    constructor(props: {
        username: string
        isSuperuser: boolean
        settings: ClientSettings
    }) {
        makeObservable<Admin, "addRequest" | "removeRequest">(this, {
            errorMessage: observable,
            currentRequests: observable,
            showLoadingIndicator: computed,
            loadingIndicatorSetting: observable,
            setErrorMessage: action.bound,
            addRequest: action.bound,
            removeRequest: action.bound
        });

        this.basePath = "/admin"
        this.username = props.username
        this.isSuperuser = props.isSuperuser
        this.settings = props.settings
    }

    currentRequests: Promise<Response>[] = [];

    get showLoadingIndicator(): boolean {
        return this.loadingIndicatorSetting === "default"
            ? this.currentRequests.length > 0
            : this.loadingIndicatorSetting === "loading"
    }

    loadingIndicatorSetting: "loading" | "off" | "default" = "default";

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
        method: HTTPMethod
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
            credentials: "same-origin",
            headers: headers,
            body: method !== "GET" ? data : undefined,
        })
    }

    // Make a request and expect JSON
    // If we can't retrieve and parse JSON, it is treated as a fatal/unexpected error
    async requestJSON(
        path: string,
        data: Json | File,
        method: HTTPMethod,
        opts: { onFailure?: "show" | "continue" } = {}
    ): Promise<Json> {
        const onFailure = opts.onFailure || "show"

        let targetPath = path
        // Tack params on the end if it's a GET request
        if (method === "GET" && !lodash.isEmpty(data)) {
            targetPath += queryParamsToStr(data as Json)
        }

        let response: Response | undefined
        let text: string | undefined
        let json: Json

        let request: Promise<Response> | undefined
        try {
            request = this.rawRequest(
                targetPath,
                data instanceof File ? data : JSON.stringify(data),
                method
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
                        (stringifyUnkownError(err) || text) ??
                        "unexpected error value in setErrorMessage",
                    isFatal: response?.status !== 404,
                })
            throw err
        } finally {
            if (request) this.removeRequest(request)
        }

        return json
    }

    setErrorMessage(message: ErrorMessage): void {
        this.errorMessage = message
    }

    private addRequest(request: Promise<Response>): void {
        this.currentRequests.push(request)
    }

    private removeRequest(request: Promise<Response>): void {
        this.currentRequests = this.currentRequests.filter(
            (req) => req !== request
        )
    }

    async getJSON(path: string, params: Json = {}): Promise<Json> {
        return this.requestJSON(path, params, "GET")
    }
}
