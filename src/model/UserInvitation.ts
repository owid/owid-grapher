
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
    @Column() validTill!: Date
    @Column() createdAt!: Date
    @Column() updatedAt!: Date
}