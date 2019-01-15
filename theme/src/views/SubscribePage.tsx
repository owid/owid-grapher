import * as settings from '../settings'
import * as React from 'react'
import { Head } from './Head'

export default function SubscribePage() {
    const style = `
        body {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
        }
        main {
            max-width: 1080px;
            padding: 40px 20px;
            margin: auto;
            min-height: 0;
        }
        h1 {
            line-height: 1.1em;
        }

        input[type=email] {
            width: 100%;
            padding: 10px;
            border: 1px solid #ccc;
        }

        input[type=submit] {
            margin-top: 10px;
            background: #5d5d5d;
            color: #fff;
            padding: 10px 22px;
            cursor: pointer;
        }
    `

    return <html>
        <Head pageTitle="Subscribe" canonicalUrl={`${settings.BAKED_URL}/subscribe`}>
            <style dangerouslySetInnerHTML={{__html: style}}/>
        </Head>
        <body className="SubscribePage">
            <main>
                <h1>Subscribe to Our World in Data</h1>
                <p>Want to keep up with new data? Sign up for email updates.</p>
                <form action="https://ourworldindata.us8.list-manage.com/subscribe/post?u=18058af086319ba6afad752ec&id=2e166c1fc1" method="post" id="mc-embedded-subscribe-form" name="mc-embedded-subscribe-form" target="_blank">
                    <input type="email" placeholder="Email" name="EMAIL" className="required email" id="mce-EMAIL" aria-label="Email"/>
                    <input type="submit" value="Subscribe" name="subscribe" id="mc-embedded-subscribe" className="button"/>
                    <div style={{ position: 'absolute', left: '-5000px' }}><input type="text" name="b_18058af086319ba6afad752ec_2e166c1fc1" tabIndex={-1}/></div>
                </form>
                <p>You can also subscribe using our <a href="/feed">RSS feed</a>.</p>
            </main>
        </body>
    </html>
}