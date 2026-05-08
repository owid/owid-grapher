import { useTradeData } from "../data"

import "./Placeholder.scss"

export function Placeholder() {
    const { data, status, error } = useTradeData()

    return (
        <div className="food-trade-placeholder">
            <h2>Food trade</h2>
            {status === "pending" && <p>Loading trade data…</p>}
            {status === "error" && (
                <p>Error loading trade data: {error.message}</p>
            )}
            {status === "success" && (
                <>
                    <p>Loaded {data.length.toLocaleString()} rows.</p>
                    <pre>{JSON.stringify(data[0], null, 2)}</pre>
                </>
            )}
        </div>
    )
}
