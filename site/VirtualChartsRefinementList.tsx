import {
    useInstantSearch,
    useRefinementList,
} from "react-instantsearch-hooks-web"
import { RefinementListConnectorParams } from "instantsearch.js/es/connectors/refinement-list/connectRefinementList.js"
import { CHARTS_INDEX, PAGES_INDEX } from "./SearchApp.js"
import { useEffect } from "react"

export function VirtualChartsRefinementList(
    props: RefinementListConnectorParams
) {
    const { uiState, setUiState } = useInstantSearch()

    useRefinementList(props)

    useEffect(
        () => {
            setUiState((prevUiState) => {
                return {
                    ...prevUiState,
                    [CHARTS_INDEX]: {
                        refinementList: uiState[PAGES_INDEX].refinementList,
                    },
                }
            })
        },
        // deep equality hack to avoid infinite re-render. Ok-ish since
        // refinementList is a straighforward array (small, no Dates, etc.)
        [JSON.stringify(uiState[PAGES_INDEX].refinementList)]
    )

    return null
}
