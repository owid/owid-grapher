
import {Entity, PrimaryGeneratedColumn, Column, BaseEntity, CreateDateColumn, UpdateDateColumn} from "typeorm"
import * as randomstring from 'randomstring'

@Entity("user_invitations")
export default class UserInvitation extends BaseEntity {
    static makeInviteCode(): string {
        return randomstring.generate()
    }

    @PrimaryGeneratedColumn() id!: number
    @Column() code!: string
    @Column() email!: string
    @Column({ name: 'valid_till' }) validTill!: Date
    // Hack - some weirdness going on with default values and typeorm
    @Column() created_at!: Date
    @Column() updated_at!: Date

    // Deprecated
    @Column() status: string = "pending"
    @Column() user_id!: number
}