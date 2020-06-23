import * as React from "react"
import { webpack } from "./webpack"

export function RegisterPage(props: {
    inviteEmail?: string
    errorMessage?: string
    body: any
}) {
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
                    <p>
                        Register an account to access the{" "}
                        <a href="https://ourworldindata.org">
                            ourworldindata.org
                        </a>{" "}
                        database and chart editor.
                    </p>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            name="email"
                            type="email"
                            className="form-control"
                            placeholder="Email"
                            required
                            value={props.body.email || props.inviteEmail}
                        />
                    </div>
                    <div className="form-group">
                        <label>Name</label>
                        <input
                            name="fullName"
                            className="form-control"
                            placeholder="Full name"
                            required
                            value={props.body.fullName}
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
                            value={props.body.password}
                        />
                    </div>
                    <div className="form-group">
                        <label>Confirm Password</label>
                        <input
                            name="confirmPassword"
                            type="password"
                            className="form-control"
                            placeholder="Password"
                            required
                            value={props.body.confirmPassword}
                        />
                    </div>
                    <input type="hidden" name="code" value={props.body.code} />
                    {props.errorMessage && (
                        <div className="alert alert-danger">
                            {props.errorMessage}
                        </div>
                    )}
                    <button type="submit" className="btn btn-primary">
                        Register
                    </button>
                </form>
            </body>
        </html>
    )
}
