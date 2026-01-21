// Enable sidepanel on Google Docs pages
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Error setting panel behavior:", error))

// Set up sidepanel for Google Docs pages
chrome.tabs.onUpdated.addListener(async (tabId, _info, tab) => {
    if (!tab.url) return

    const isGoogleDoc = tab.url.match(
        /^https:\/\/docs\.google\.com\/document\/d\//
    )

    if (isGoogleDoc) {
        await chrome.sidePanel.setOptions({
            tabId,
            path: "sidepanel/sidepanel.html",
            enabled: true,
        })
    } else {
        await chrome.sidePanel.setOptions({
            tabId,
            enabled: false,
        })
    }
})

// Get cookies for the appropriate domain based on URL
async function getCookiesForUrl(url: string): Promise<string> {
    // Check if cookies API is available (requires "cookies" permission in manifest)
    if (!chrome.cookies) {
        console.error(
            "chrome.cookies API not available. Make sure the extension has been reloaded after adding the cookies permission."
        )
        throw new Error(
            "Cookies API not available. Please reload the extension in chrome://extensions"
        )
    }

    // Determine the cookie domain based on the URL
    let cookies: chrome.cookies.Cookie[]
    if (url.includes("localhost")) {
        // For localhost, get cookies by URL since domain matching is tricky
        cookies = await chrome.cookies.getAll({ url: "http://localhost:3030" })
    } else {
        cookies = await chrome.cookies.getAll({ domain: "admin.owid.io" })
    }

    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ")
    return cookieString
}

interface ProxyError {
    message: string
    status?: number
}

function buildProxyError(message: string, status?: number): ProxyError {
    return { message, status }
}

function getProxyErrorDetails(error: unknown): ProxyError {
    if (typeof error === "object" && error !== null && "message" in error) {
        const status =
            "status" in error &&
            typeof (error as ProxyError).status === "number"
                ? (error as ProxyError).status
                : undefined
        return { message: String((error as ProxyError).message), status }
    }

    if (error instanceof Error) {
        return { message: error.message }
    }

    return { message: String(error) }
}

// Proxy API requests from sidepanel (which can't access chrome.cookies)
async function proxyFetch(url: string): Promise<unknown> {
    const cookieHeader = await getCookiesForUrl(url)

    const response = await fetch(url, {
        credentials: "include",
        headers: {
            Accept: "application/json",
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
    })

    const contentType = response.headers.get("content-type") ?? ""
    const isJson = contentType.includes("application/json")
    const isAuthStatus = response.status === 401 || response.status === 403
    const isLoginPage = response.url.includes("/admin/login")
    const isLoginRedirect = response.redirected && isLoginPage

    if (isAuthStatus) {
        throw buildProxyError("Please log in to OWID admin", response.status)
    }

    if (isLoginRedirect || (isLoginPage && !isJson)) {
        throw buildProxyError("Please log in to OWID admin", 401)
    }

    if (!response.ok) {
        const text = await response.text()
        throw buildProxyError(
            text || `HTTP ${response.status}`,
            response.status
        )
    }

    if (!isJson) {
        throw buildProxyError(
            "Unexpected non-JSON response from admin API",
            response.status
        )
    }

    return response.json()
}

// Listen for messages from sidepanel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "FETCH_API") {
        proxyFetch(message.url)
            .then((data) => sendResponse({ success: true, data }))
            .catch((error) => {
                const { message: errorMessage, status } =
                    getProxyErrorDetails(error)
                sendResponse({ success: false, error: errorMessage, status })
            })
        return true // Will respond asynchronously
    }

    return false
})
