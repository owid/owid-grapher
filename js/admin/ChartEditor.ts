/* ChartEditor.ts
 * ================
 *
 * Mobx store that represents the current editor state and governs non-UI-related operations.
 *
 */

import { observable, computed, reaction } from 'mobx'
import { extend, toString, uniq } from '../charts/Util'
import ChartConfig from '../charts/ChartConfig'
import EditorFeatures from './EditorFeatures'
import Admin from './Admin'

declare const Global: { rootUrl: string }

export type EditorTab = string

export interface Variable {
    id: number
    name: string
}

export interface Dataset {
    name: string
    namespace: string
    variables: Variable[]
}

// This contains the dataset/variable metadata for the entire database
// Used for variable selector interface
export class EditorDatabase {
    @observable.ref datasets: Dataset[]

    @computed get namespaces(): string[] {
        return uniq(this.datasets.map(d => d.namespace))
    }

    constructor(json: any) {
        this.datasets = json.datasets
    }
}

export interface ChartEditorProps {
    chart: ChartConfig
    database: EditorDatabase
}

export default class ChartEditor {
    props: ChartEditorProps
    // Whether the current chart state is saved or not
    @observable.ref isSaved: boolean = true
    @observable.ref currentRequest: Promise<any> | undefined
    @observable.ref tab: EditorTab = 'basic'

    constructor(props: ChartEditorProps) {
        this.props = props
        reaction(
            () => this.chart && this.chart.json,
            () => this.isSaved = false
        )
    }

    @computed get chart(): ChartConfig {
        return this.props.chart
    }

    @computed get database(): EditorDatabase {
        return this.props.database
    }

    @computed get availableTabs(): EditorTab[] {
        if (!this.chart.activeTransform.isValidConfig) {
            return ['basic']
        } else {
            const tabs: EditorTab[] = ['basic', 'data', 'text', 'customize']
            if (this.chart.hasMapTab) tabs.push('map')
            if (this.chart.isScatter) tabs.push('scatter')
            return tabs
        }
    }

    @computed get isNewChart() {
        return this.chart.props.id === undefined
    }

    @computed get features() {
        return new EditorFeatures(this)
    }

    // Track whether we're currently loading something
    load<T>(promise: Promise<T>) {
        this.currentRequest = promise
        promise.then(() => this.currentRequest = undefined).catch(() => this.currentRequest = undefined)
        return promise
    }

    async saveChart({ onError }: { onError?: () => void } = {}) {
        const { chart, isNewChart } = this

        const targetUrl = isNewChart ? "/admin/charts" : `/admin/charts/${chart.props.id}`

        const handleError = (err: string) => {
            const $modal = modal({ title: "Error saving chart", content: toString(err) })
            $modal.addClass("error")
            if (onError) onError()
        }

        try {
            const response = await this.load(Admin.request(targetUrl, chart.json, isNewChart ? 'POST' : 'PUT'))
            if (!response.ok)
                return handleError(await response.text())

            const json = await response.json()

            if (isNewChart) {
                window.location.assign(Admin.url(`/admin/charts/${json.data.id}/edit`))
            } else {
                this.isSaved = true
            }
        } catch (err) {
            handleError(err)
        }
    }

    async saveAsNewChart() {
        const { chart } = this

        const chartJson = chart.json
        delete chartJson.id
        delete chartJson.published

        // Need to open intermediary tab before AJAX to avoid popup blockers
        const w = window.open("/", "_blank")

        const handleError = (err: string) => {
            w.close()
            const $modal = modal({ title: "Error saving chart", content: toString(err) })
            $modal.addClass("error")
        }

        try {
            const response = await this.load(Admin.request("/admin/charts", chartJson, 'POST'))
            if (!response.ok)
                return handleError(await response.text())

            const json = await response.json()

            w.location.assign(Admin.url(`/admin/charts/${json.data.id}/edit`))
        } catch (err) {
            handleError(err)
        }
    }

    publishChart() {
        const url = Global.rootUrl + "/" + this.chart.data.slug

        const $modal = modal()
        $modal.find(".modal-title").html("Publish chart")
        $modal.find(".modal-body").html(
            '<p>This chart will be available at:</p>' +
            '<p><a href="' + url + '" target="_blank">' + url + '</a></p>' +
            '<p>Proceed?</p>'
        )
        $modal.find(".modal-footer").html(
            '<button class="btn btn-danger">Publish chart</button>' +
            '<button class="btn btn-cancel" data-dismiss="modal">Cancel</button>'
        )

        $modal.find(".btn-danger").on("click", () => {
            $modal.modal('hide')

            this.chart.props.isPublished = true
            this.saveChart({ onError: () => this.chart.props.isPublished = undefined })
        })
    }

    unpublishChart() {
        if (window.confirm("Really unpublish chart?")) {
            this.chart.props.isPublished = undefined
            this.saveChart({ onError: () => this.chart.props.isPublished = true })
        }
    }
}

// XXX this is old stuff
function modal(options?: any) {
    options = extend({}, options)
    $(".owidModal").remove()

    const html = '<div class="modal owidModal fade" role="dialog">' +
        '<div class="modal-dialog modal-lg">' +
        '<div class="modal-content">' +
        '<div class="modal-header">' +
        '<button type="button" class="close" data-dismiss="modal" aria-label="Close">' +
        '<span aria-hidden="true">&times;</span>' +
        '</button>' +
        '<h4 class="modal-title"></h4>' +
        '</div>' +
        '<div class="modal-body">' +
        '</div>' +
        '<div class="modal-footer">' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>'

    $("body").prepend(html)
    const $modal = $(".owidModal") as any
    $modal.find(".modal-title").html(options.title)
    $modal.find(".modal-body").html(options.content)
    $modal.modal("show")
    return $modal
}