import {
    DbInsertNewsletter,
    DbPlainNewsletter,
    LatestNewsletter,
    NewsletterType,
    NewslettersTableName,
} from "@ourworldindata/types"
import * as db from "../db"

export async function upsertNewsletters(
    knex: db.KnexReadWriteTransaction,
    newsletters: DbInsertNewsletter[]
): Promise<void> {
    if (!newsletters.length) return
    await knex<DbPlainNewsletter>(NewslettersTableName)
        .insert(newsletters)
        .onConflict("mailchimpId")
        .merge(["type", "title", "url", "publishedAt"])
}

export async function getNewslettersByType(
    knex: db.KnexReadonlyTransaction,
    type: NewsletterType
): Promise<DbPlainNewsletter[]> {
    return knex<DbPlainNewsletter>(NewslettersTableName)
        .where({ type })
        .orderBy("publishedAt", "desc")
}

/**
 * Newsletters shown as tiles on /latest, newest first. Only Brief-era
 * campaigns (subject starting with "The OWID Brief") qualify: the same
 * audience previously received "Biweekly Digest" emails, many with bare,
 * repetitive subject lines that would make poor tiles.
 */
export async function getLatestFeedNewsletters(
    knex: db.KnexReadonlyTransaction
): Promise<LatestNewsletter[]> {
    const rows = await knex<DbPlainNewsletter>(NewslettersTableName)
        .where({ type: "owid-brief" })
        .andWhere("title", "like", "The OWID Brief%")
        .orderBy("publishedAt", "desc")
    return rows.map((row) => ({
        mailchimpId: row.mailchimpId,
        title: row.title,
        url: row.url,
        date: row.publishedAt.toISOString(),
    }))
}

export async function getLatestNewsletterByType(
    knex: db.KnexReadonlyTransaction,
    type: NewsletterType
): Promise<DbPlainNewsletter | undefined> {
    return knex<DbPlainNewsletter>(NewslettersTableName)
        .where({ type })
        .orderBy("publishedAt", "desc")
        .first()
}
