import React from "react"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import { FeedbackForm } from "site/client/Feedback"

export class FeedbackPage extends React.Component<{ baseUrl: string }> {
    render() {
        return (
            <html>
                <Head
                    canonicalUrl={`${this.props.baseUrl}/feedback`}
                    pageTitle="Feedback"
                    pageDesc="Do you have feedback or suggestions for improving Our World in Data? Let us know!"
                />
                <body className="FeedbackPage">
                    <SiteHeader />
                    <main>
                        <FeedbackForm />
                    </main>
                    <SiteFooter hideDonate={true} />
                </body>
                <script>{`window.runFeedbackPage()`}</script>
            </html>
        )
    }
}
