// Static utilities to bind the global window URL to a ChartUrl object.

import { reaction, IReactionDisposer } from "mobx"
import {
    setWindowQueryStr,
    queryParamsToStr,
    QueryParams,
} from "utils/client/url"

import { debounce } from "grapher/utils/Util"

export interface ObjectThatSerializesToQueryParams {
    params: QueryParams
    debounceMode?: boolean
}

export class UrlBinder {
    private disposer?: IReactionDisposer
    bindToWindow(obj: ObjectThatSerializesToQueryParams) {
        // There is a surprisingly considerable performance overhead to updating the url
        // while animating, so we debounce to allow e.g. smoother timelines
        const pushParams = () => {
            const str = queryParamsToStr(obj.params)
            console.log(str)
            return setWindowQueryStr(str)
        }
        const debouncedPushParams = debounce(pushParams, 100)

        this.disposer = reaction(
            () => obj.params,
            () => (obj.debounceMode ? debouncedPushParams() : pushParams())
        )
    }

    unbindFromWindow() {
        this.disposer!()
    }
}
