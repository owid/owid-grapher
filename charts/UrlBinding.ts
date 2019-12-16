// Static utilities to bind the global window URL to a ChartUrl object.

import { reaction } from "mobx"
import {
    setWindowQueryStr,
    queryParamsToStr,
    QueryParams
} from "utils/client/url"

import { debounce } from "./Util"

export interface ObservableUrl {
    params: QueryParams
    debounceMode: boolean
}

export function bindUrlToWindow(url: ObservableUrl) {
    // There is a surprisingly considerable performance overhead to updating the url
    // while animating, so we debounce to allow e.g. smoother timelines
    const pushParams = () => setWindowQueryStr(queryParamsToStr(url.params))
    const debouncedPushParams = debounce(pushParams, 100)

    // We ignore the disposer here, because this reaction lasts for the
    // lifetime of the window. -@jasoncrawford 2019-12-16
    reaction(
        () => url.params,
        () => (url.debounceMode ? debouncedPushParams() : pushParams())
    )
}
