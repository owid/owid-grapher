import * as nodemailer from 'nodemailer'

import * as settings from 'settings'

const transporter = nodemailer.createTransport({
    host: settings.EMAIL_HOST,
    port: settings.EMAIL_PORT,
    secure: settings.EMAIL_PORT === 465,
    auth: {
        user: settings.EMAIL_HOST_USER,
        pass: settings.EMAIL_HOST_PASSWORD
    }
})

export async function sendMail(options: nodemailer.SendMailOptions): Promise<any> {
    return new Promise((resolve, reject) => {
        transporter.sendMail(options, (err, info) => {
            if (err) return reject(err)
            else resolve(info)
        })
    })
}