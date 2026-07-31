import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { Html } from "./Html.js"
import NotFoundPageForm from "./NotFoundPageForm.js"
import NotFoundPageIcon from "./NotFoundPageIcon.js"

export default function NotFoundPage({ baseUrl }: { baseUrl: string }) {
    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/search`}
                pageTitle="404 Not Found"
                pageDesc="Sorry, this page doesn’t exist!"
                baseUrl={baseUrl}
                noindex
            />
            <body className="NotFoundPage">
                <SiteHeader />
                <main>
                    <NotFoundPageIcon />
                    <div className="NotFoundPage__copy">
                        <h1 className="NotFoundPage__heading subtitle-1">
                            Sorry, this page doesn’t exist!
                        </h1>
                        <p className="body-2-semibold">
                            You may have followed an outdated link or have
                            mistyped the URL.
                            <br />
                            You can search for what you were hoping to find
                            below or <a href="/">visit our homepage</a>.
                        </p>
                    </div>
                    <div id="not-found-page-form">
                        <NotFoundPageForm />
                    </div>
                </main>
                <SiteFooter hideDonate />
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
