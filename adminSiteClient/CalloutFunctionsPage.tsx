import { useContext, useState, useEffect, useCallback } from "react"
import { useLocation, useHistory } from "react-router-dom"
import { AdminAppContext } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"
import { Alert, Button, Input, Spin } from "antd"

type CalloutFunctionsResponse = {
    url: string
    functionStringsByName: Record<string, string[]>
}

export const CalloutFunctionsPage = () => {
    const { admin } = useContext(AdminAppContext)
    const location = useLocation()
    const history = useHistory()

    // Get initial URL from query params
    const searchParams = new URLSearchParams(location.search)
    const initialUrl = searchParams.get("url") ?? ""

    const [chartUrl, setChartUrl] = useState(initialUrl)
    const [data, setData] = useState<CalloutFunctionsResponse | undefined>()
    const [error, setError] = useState<string | undefined>()
    const [isLoading, setIsLoading] = useState(false)

    const fetchFunctions = useCallback(
        async (url: string) => {
            if (!url.trim()) return

            setIsLoading(true)
            setError(undefined)
            setData(undefined)

            try {
                const response = await admin.getJSON(
                    `/api/callout-functions?url=${encodeURIComponent(url)}`
                )
                setData(response as CalloutFunctionsResponse)
            } catch (err) {
                setError(String(err))
            } finally {
                setIsLoading(false)
            }
        },
        [admin]
    )

    // Auto-fetch if URL is provided in query params
    useEffect(() => {
        if (initialUrl) {
            void fetchFunctions(initialUrl)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!chartUrl.trim()) return

        // Update query params
        const newSearchParams = new URLSearchParams()
        newSearchParams.set("url", chartUrl)
        history.replace({ search: newSearchParams.toString() })

        await fetchFunctions(chartUrl)
    }

    return (
        <AdminLayout title="Callout function strings">
            <main className="CalloutFunctionsPage">
                <h2>Callout Function Strings</h2>
                <p>
                    Enter a chart URL to get the available function strings for
                    use in data-callout blocks.
                </p>

                <form
                    onSubmit={handleSubmit}
                    className="CalloutFunctionsPage__form"
                >
                    <div className="CalloutFunctionsPage__input-group">
                        <Input
                            type="text"
                            value={chartUrl}
                            onChange={(e) => setChartUrl(e.target.value)}
                            placeholder="https://ourworldindata.org/grapher/life-expectancy"
                        />
                        <Button
                            type="primary"
                            htmlType="submit"
                            disabled={isLoading || !chartUrl.trim()}
                        >
                            {isLoading ? (
                                <Spin size="small" />
                            ) : (
                                "Get Functions"
                            )}
                        </Button>
                    </div>
                </form>

                {error && <Alert className="mt-3" type="error" title={error} />}

                {data && (
                    <div className="CalloutFunctionsPage__results mt-4">
                        <h4>Available function strings:</h4>
                        <p className="text-muted">
                            Copy these into your data-callout blocks
                        </p>
                        <ul className="CalloutFunctionsPage__function-list">
                            {Object.entries(data.functionStringsByName).map(
                                ([name, fns]) => (
                                    <li
                                        key={name}
                                        className="CalloutFunctionsPage__column-functions"
                                    >
                                        <span>{name}</span>
                                        <ul>
                                            {fns.map((fn) => (
                                                <li key={fn}>
                                                    <code>{fn}</code>
                                                    <Button
                                                        className="ms-2"
                                                        size="small"
                                                        onClick={() =>
                                                            navigator.clipboard.writeText(
                                                                fn
                                                            )
                                                        }
                                                        title="Copy to clipboard"
                                                    >
                                                        Copy
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                )
                            )}
                        </ul>
                    </div>
                )}
            </main>
        </AdminLayout>
    )
}
