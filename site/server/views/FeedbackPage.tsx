import React from "react"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import { FeedbackForm } from "site/client/Feedback"

export class FeedbackPage extends React.Component<{ baseUrl: string }> {
    render() {
        const { baseUrl } = this.props
        return (
            <html>
                <Head
                    canonicalUrl={`${baseUrl}/feedback`}
                    pageTitle="Feedback"
                    pageDesc="Do you have feedback or suggestions for improving Our World in Data? Let us know!"
                />
                <body className="FeedbackPage">
                    <SiteHeader baseUrl={baseUrl} />
                    <main>
                        <FeedbackForm />
                    </main>
                    <SiteFooter hideDonate={true} baseUrl={baseUrl} />
                </body>
                <script>{`window.runFeedbackPage()`}</script>
            </html>
        )
    }
}
