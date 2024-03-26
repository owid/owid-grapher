import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    OneToMany,
    type Relation,
} from "typeorm"
import { Chart } from "./Chart.js"
import { Dataset } from "./Dataset.js"
import { ChartRevision } from "./ChartRevision.js"
import { BCryptHasher } from "../hashers.js"
import {
    DbPlainUser,
    DbInsertUser,
    UsersTableName,
} from "@ourworldindata/types"
import { KnexReadWriteTransaction, KnexReadonlyTransaction } from "../db.js"

@Entity("users")
export class User extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column({ unique: true }) email!: string
    @Column({ length: 128 }) password!: string
    @Column({ default: "" }) fullName!: string
    @Column({ default: true }) isActive!: boolean
    @Column({ default: false }) isSuperuser!: boolean
    @Column() createdAt!: Date
    @Column() updatedAt!: Date
    @Column() lastLogin!: Date
    @Column() lastSeen!: Date

    @OneToMany(() => Chart, (chart) => chart.lastEditedByUser)
    lastEditedCharts!: Relation<Chart[]>

    @OneToMany(() => Chart, (chart) => chart.publishedByUser)
    publishedCharts!: Relation<Chart[]>

    @OneToMany(() => ChartRevision, (rev) => rev.user)
    editedCharts!: Relation<ChartRevision[]>

    @OneToMany(() => Dataset, (dataset) => dataset.createdByUser)
    createdDatasets!: Relation<Dataset[]>
}

export async function setPassword(
    knex: KnexReadWriteTransaction,
    id: number,
    password: string
): Promise<void> {
    const h = new BCryptHasher()
    const encrypted = await h.encode(password)
    await updateUser(knex, id, { password: encrypted })
}

export async function getUserById(
    knex: KnexReadonlyTransaction,
    id: number
): Promise<DbPlainUser | undefined> {
    return knex<DbPlainUser>(UsersTableName).where({ id }).first()
}

export async function insertUser(
    knex: KnexReadWriteTransaction,
    user: DbInsertUser
): Promise<{ id: number }> {
    return knex(UsersTableName).returning("id").insert(user)
}

export async function updateUser(
    knex: KnexReadWriteTransaction,
    id: number,
    user: Partial<DbInsertUser>
): Promise<void> {
    return knex(UsersTableName).where({ id }).update(user)
}

export async function deleteUser(
    knex: KnexReadWriteTransaction,
    id: number
): Promise<void> {
    return knex(UsersTableName).where({ id }).delete()
}
