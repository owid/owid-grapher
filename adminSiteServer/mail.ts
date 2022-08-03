import * as nodemailer from "nodemailer"

import {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_HOST_USER,
    EMAIL_HOST_PASSWORD,
    EMAIL_USE_TLS,
} from "../settings/serverSettings.js"

const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_USE_TLS,
    auth: {
        user: EMAIL_HOST_USER,
        pass: EMAIL_HOST_PASSWORD,
    },
})

// get rid of this?
export async function sendMail(
    options: nodemailer.SendMailOptions
): Promise<any> {
    return new Promise((resolve, reject) => {
        transporter.sendMail(options, (err, info) => {
            if (err) return reject(err)
            else resolve(info)
        })
    })
}
