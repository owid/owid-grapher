import fuzzysort from "fuzzysort"
import { keyBy } from "charts/utils/Util"
import { observable, computed, action, autorun } from "mobx"
import { Analytics } from "charts/core/Analytics"
import { highlight as fuzzyHighlight } from "charts/controls/FuzzySearch"
import { ENV } from "settings"
interface ChartItem {
    title: string
    li: HTMLLIElement
    ul: HTMLUListElement
}

interface SearchResult {
    target: string
}

function encodeHashSafe(s: string) {
    return encodeURIComponent(s.replace(/ /g, "-"))
}

function decodeHashSafe(s: string) {
    return decodeURIComponent(s).replace(/-/g, " ")
}

class ChartFilter {
    searchInput: HTMLInputElement
    chartItems: ChartItem[] = []
    chartItemsByTitle: { [key: string]: ChartItem } = {}
    strings: (Fuzzysort.Prepared | undefined)[]
    results: any[] = []
    sections: HTMLDivElement[] = []

    @observable query: string = ""

    @computed get searchStrings(): (Fuzzysort.Prepared | undefined)[] {
        return this.chartItems.map(c => fuzzysort.prepare(c.title))
    }

    @computed get searchResults(): Fuzzysort.Results {
        return fuzzysort.go(this.query, this.searchStrings, { threshold: -150 })
    }

    @computed get resultsByTitle(): { [key: string]: Fuzzysort.Result } {
        return keyBy(this.searchResults, "target")
    }

    constructor() {
        this.searchInput = document.querySelector(
            ".chartsSearchInput"
        ) as HTMLInputElement
        this.sections = Array.from(
            document.querySelectorAll(".ChartsIndexPage main .content section")
        ) as HTMLDivElement[]
        const lis = Array.from(
            document.querySelectorAll(".ChartsIndexPage main .content li")
        ) as HTMLLIElement[]
        this.chartItems = lis.map(li => ({
            title: (li.children[0].textContent as string).replace(/₂/g, "2"),
            li: li,
            ul: li.closest("ul") as HTMLUListElement
        }))
        this.chartItemsByTitle = keyBy(this.chartItems, "title")
        this.strings = this.chartItems.map(c => fuzzysort.prepare(c.title))
    }

    analytics = new Analytics(ENV)

    @action.bound logSearchQuery() {
        this.analytics.logChartsPageSearchQuery(this.query)
    }

    timeout?: NodeJS.Timeout
    @action.bound onSearchInput() {
        this.query = this.searchInput.value

        if (this.timeout !== undefined) {
            clearTimeout(this.timeout)
        }
        this.timeout = setTimeout(this.logSearchQuery, 500)
    }

    /*@action.bound onKeydown(ev: KeyboardEvent) {
        if (ev.keyCode === 13 && this.query && this.searchResults.length) {
            const href = this.chartItemsByTitle[this.searchResults[0].target].li.children[0].getAttribute('href') as string
            window.location.assign(href)
        }
    }*/

    render() {
        history.replaceState(
            null,
            document.title,
            window.location.pathname +
                (this.query ? `?search=${encodeHashSafe(this.query)}` : "")
        )

        if (!this.query) {
            for (const section of this.sections) {
                section.style.display = ""
            }
            for (const c of this.chartItems) {
                c.ul.append(c.li)
                c.li.style.display = ""
                c.li.children[0].innerHTML = c.title
            }

            return
        }

        /*for (let i = this.searchResults.length-1; i >= 0; i--) {
            const c = this.chartItemsByTitle[this.searchResults[i].target]
            c.ul.prepend(c.li)
        }*/

        for (const c of this.chartItems) {
            const res = this.resultsByTitle[c.title]
            if (!res) {
                c.li.style.display = "none"
            } else {
                c.li.style.display = ""
                c.li.children[0].innerHTML = fuzzyHighlight(res) ?? ""
            }
        }

        // Ensure tag headings are only shown if they have charts under them
        for (const section of this.sections) {
            if (
                !Array.from(section.querySelectorAll("li")).some(
                    li => li.style.display !== "none"
                )
            ) {
                section.style.display = "none"
            } else {
                section.style.display = ""
            }
        }
    }

    @action.bound run() {
        this.searchInput.addEventListener("input", this.onSearchInput)
        //this.searchInput.addEventListener('keydown', this.onKeydown)

        autorun(() => this.render())

        const m = window.location.search.match(/search=(.+)/)
        if (m) {
            this.searchInput.value = decodeHashSafe(m[1])
        }
        this.query = this.searchInput.value
    }
}

export function runChartsIndexPage() {
    const searcher = new ChartFilter()
    searcher.run()
}
