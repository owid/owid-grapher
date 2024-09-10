import * as React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { Html } from "./Html.js"
import NotFoundPageForm from "./NotFoundPageForm.js"

export default function NotFoundPage({ baseUrl }: { baseUrl: string }) {
    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/search`}
                pageTitle="404 Not Found"
                pageDesc="Search articles and charts on Our World in Data."
                baseUrl={baseUrl}
            />
            <body className="NotFoundPage">
                <SiteHeader baseUrl={baseUrl} />
                <main>
                    <NotFoundPageIcon />
                    <h1 className="NotFoundPage__heading subtitle-1">
                        Sorry, that page doesn’t exist!
                    </h1>
                    <p className="body-2-semibold">
                        You may have followed an outdated link or have mistyped
                        the URL.
                    </p>
                    <p className="body-2-semibold">
                        You can search for what you were hoping to find below or{" "}
                        <a href="/">visit our homepage</a>.
                    </p>
                    <div id="not-found-page-form">
                        <NotFoundPageForm />
                    </div>
                </main>
                <SiteFooter hideDonate={true} baseUrl={baseUrl} />
                <script
                    type="module"
                    dangerouslySetInnerHTML={{
                        __html: `
                window.runNotFoundPage()
            `,
                    }}
                />
            </body>
        </Html>
    )
}

function NotFoundPageIcon() {
    return (
        <svg
            className="NotFoundPageIcon"
            width="194"
            height="194"
            viewBox="0 0 194 194"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <rect width="194" height="194" rx="97" fill="#EBEEF2" />
            <path
                d="M129.439 65.08H64.6391C61.519 65.08 59.0391 67.6399 59.0391 70.68V123.32C59.0391 126.44 61.5989 128.92 64.6391 128.92H129.359C132.479 128.92 134.959 126.36 134.959 123.32V70.68C135.039 67.56 132.479 65.08 129.439 65.08ZM83.0391 70.8402C84.3989 70.8402 85.4391 71.9602 85.4391 73.2402C85.4391 74.6 84.319 75.6401 83.0391 75.6401C81.6792 75.6401 80.6391 74.5201 80.6391 73.2402C80.6391 71.88 81.6792 70.8402 83.0391 70.8402ZM75.6791 70.8402C77.0389 70.8402 78.0791 71.9602 78.0791 73.2402C78.0791 74.6 76.959 75.6401 75.6791 75.6401C74.3192 75.6401 73.2791 74.5201 73.2791 73.2402C73.2791 71.88 74.3989 70.8402 75.6791 70.8402ZM68.3191 70.8402C69.6789 70.8402 70.7191 71.9602 70.7191 73.2402C70.7191 74.6 69.599 75.6401 68.3191 75.6401C66.9592 75.6401 65.9191 74.5201 65.9191 73.2402C65.9191 71.88 67.0391 70.8402 68.3191 70.8402ZM127.759 121.24C127.759 121.48 127.599 121.64 127.359 121.64H66.7191C66.479 121.64 66.3191 121.48 66.3191 121.24V81.4802H127.759V121.24Z"
                fill="#6E87A2"
            />
            <path
                d="M74.36 106.004H80.5199V110.386C80.5199 110.785 80.8399 111.183 81.3199 111.183H83.7998C84.1998 111.183 84.5998 110.864 84.5998 110.386V106.004H86.8399C87.2399 106.004 87.6399 105.685 87.6399 105.207V102.737C87.6399 102.339 87.3199 101.94 86.8399 101.94H84.5998V98.6733C84.5998 98.2749 84.2798 97.8765 83.7998 97.8765H81.3199C80.9199 97.8765 80.5199 98.1953 80.5199 98.6733V101.94H77.8797L78.6797 92.8566C78.6797 92.4582 78.3597 92.0598 77.9597 91.9801L75.5597 91.741C75.1597 91.741 74.7597 92.0598 74.6797 92.4582L73.6396 105.048C73.5599 105.685 73.88 106.004 74.3599 106.004L74.36 106.004Z"
                fill="#6E87A2"
            />
            <path
                d="M106.28 106.004H112.44V110.386C112.44 110.785 112.76 111.183 113.24 111.183H115.72C116.12 111.183 116.52 110.864 116.52 110.386V106.004H118.76C119.16 106.004 119.56 105.685 119.56 105.207V102.737C119.56 102.339 119.24 101.94 118.76 101.94H116.52V98.6733C116.52 98.2749 116.2 97.8765 115.72 97.8765H113.24C112.84 97.8765 112.44 98.1953 112.44 98.6733V101.94L109.8 101.94L110.6 92.8563C110.6 92.4579 110.28 92.0595 109.88 91.9799L107.48 91.7407C107.08 91.7407 106.68 92.0595 106.6 92.4579L105.56 105.047C105.48 105.685 105.88 106.004 106.28 106.004L106.28 106.004Z"
                fill="#6E87A2"
            />
            <path
                d="M90.9201 111.183H101.8C102.2 111.183 102.6 110.864 102.6 110.386V92.7768C102.6 92.3784 102.28 91.98 101.8 91.98H90.9201C90.5201 91.98 90.1201 92.2988 90.1201 92.7768V110.386C90.1201 110.864 90.5201 111.183 90.9201 111.183V111.183ZM94.1201 95.964H98.5201V107.199H94.1201V95.964Z"
                fill="#6E87A2"
            />
        </svg>
    )
}
