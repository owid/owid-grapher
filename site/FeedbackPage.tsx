import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { FeedbackForm } from "../site/Feedback.js"

export class FeedbackPage extends React.Component<{ baseUrl: string }> {
    render() {
        const { baseUrl } = this.props
        return (
            <html>
                <Head
                    canonicalUrl={`${baseUrl}/feedback`}
                    pageTitle="Feedback"
                    pageDesc="Do you have feedback or suggestions for improving Our World in Data? Let us know!"
                    baseUrl={baseUrl}
                />
                <body className="FeedbackPage">
                    <SiteHeader baseUrl={baseUrl} />
                    <main>
                        <FeedbackForm />
                    </main>
                    <SiteFooter hideDonate={true} baseUrl={baseUrl} />
                </body>
                <script type="module">{`window.runFeedbackPage()`}</script>
            </html>
        )
    }
}
