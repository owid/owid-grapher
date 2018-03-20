import * as React from 'react'
import webpack from './webpack'

export default function LoginPage(props: { errorMessage?: string }) {
    const style = `
        html, body {
            height: 100%;
        }

        body {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        h1 {
            margin-bottom: 0.4em;
        }

        button {
            cursor: pointer;
        }
    `
    return <html lang="en">
        <head>
            <title>owid-admin</title>
            <meta name="description" content=""/>
            <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0-alpha.6/css/bootstrap.min.css"/>
            <style>{style}</style>
        </head>
        <body>
            <form method="POST" action="/grapher/admin/login">
                <h1>owid-admin</h1>
                <div className="form-group">
                    <label>Email address</label>
                    <input name="username" type="email" className="form-control" placeholder="Enter email" required/>
                </div>
                <div className="form-group">
                    <label>Password</label>
                    <input name="password" type="password" className="form-control" placeholder="Password" required/>
                </div>
                {props.errorMessage && <div className="alert alert-danger">{props.errorMessage}</div>}
                <p>Having trouble logging in? Go to <a href="https://owid.slack.com/messages/tiny-tech-problems/">#tiny-tech-problems</a>.</p>
                <button type="submit" className="btn btn-primary">Login</button>
            </form>
        </body>
    </html>
}