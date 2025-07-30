import * as _ from "lodash-es"
import { FuzzySearch, FuzzySearchResult } from "@ourworldindata/utils"
import { action, autorun, computed, observable, makeObservable } from "mobx"
import { SiteAnalytics } from "./SiteAnalytics.js"
interface ChartItem {
    title: string
    li: HTMLLIElement
    ul: HTMLUListElement
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
    results: any[] = []
    sections: HTMLDivElement[] = []

    @observable accessor query: string = ""

    @computed private get fuzzy(): FuzzySearch<ChartItem> {
        return FuzzySearch.withKey(this.chartItems, (chart) => chart.title, {
            threshold: -150,
        })
    }

    @computed get searchResults() {
        return this.fuzzy.searchResults(this.query)
    }

    @computed get resultsByTitle(): { [key: string]: FuzzySearchResult } {
        return _.keyBy(this.searchResults, "target")
    }

    constructor() {
        makeObservable(this)
        this.searchInput = document.querySelector(
            ".chartsSearchInput"
        ) as HTMLInputElement
        this.sections = Array.from(
            document.querySelectorAll(".CountryProfilePage main section")
        ) as HTMLDivElement[]
        const lis = Array.from(
            document.querySelectorAll(".CountryProfilePage main li")
        ) as HTMLLIElement[]
        this.chartItems = lis.map((li) => ({
            title:
                li
                    .querySelector(".indicatorName > a")
                    ?.textContent?.replace(/₂/g, "2") ?? "",
            li: li,
            ul: li.closest("ul") as HTMLUListElement,
        }))
        this.chartItemsByTitle = _.keyBy(this.chartItems, "title")
    }

    analytics = new SiteAnalytics()

    @action.bound logSearchQuery() {
        this.analytics.logCountryPageSearchQuery(this.query)
    }

    timeout?: number
    @action.bound onSearchInput() {
        this.query = this.searchInput.value

        if (this.timeout !== undefined) {
            clearTimeout(this.timeout)
        }
        this.timeout = window.setTimeout(this.logSearchQuery, 500)
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
                (this.query ? `#search=${encodeHashSafe(this.query)}` : "")
        )

        if (!this.query) {
            for (const section of this.sections) {
                section.style.display = ""
            }
            for (const c of this.chartItems) {
                c.ul.append(c.li)
                c.li.style.display = ""
                c.li.children[0].children[0].innerHTML = c.title
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
                c.li.children[0].children[0].innerHTML = res.highlight() ?? ""
            }
        }

        // Ensure tag headings are only shown if they have charts under them
        for (const section of this.sections) {
            if (
                !Array.from(section.querySelectorAll("li")).some(
                    (li) => li.style.display !== "none"
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

        const m = window.location.hash.match(/search=(.+)/)
        if (m) {
            this.searchInput.value = decodeHashSafe(m[1])
        }
        this.query = this.searchInput.value
    }
}

export function runCountryProfilePage() {
    const searcher = new ChartFilter()
    searcher.run()
}
