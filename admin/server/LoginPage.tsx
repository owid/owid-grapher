import * as React from "react"
import { webpack } from "./webpack"

export function LoginPage(props: { next?: string; errorMessage?: string }) {
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
    return (
        <html lang="en">
            <head>
                <title>owid-admin</title>
                <meta name="description" content="" />
                <link
                    href={webpack("admin.css")}
                    rel="stylesheet"
                    type="text/css"
                />
                <style>{style}</style>
            </head>
            <body>
                <form method="POST">
                    <h1>owid-admin</h1>
                    <div className="form-group">
                        <label>Email address</label>
                        <input
                            name="username"
                            type="email"
                            className="form-control"
                            placeholder="Enter email"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            name="password"
                            type="password"
                            className="form-control"
                            placeholder="Password"
                            required
                        />
                    </div>
                    <input type="hidden" name="next" value={props.next} />
                    {props.errorMessage && (
                        <div className="alert alert-danger">
                            {props.errorMessage}
                        </div>
                    )}
                    <p>
                        Having trouble logging in? Go to{" "}
                        <a href="https://owid.slack.com/messages/tech-issues/">
                            #tech-issues
                        </a>
                        .
                    </p>
                    <button type="submit" className="btn btn-primary">
                        Login
                    </button>
                </form>
            </body>
        </html>
    )
}
