import * as randomstring from "randomstring"
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity("user_invitations")
export class UserInvitation extends BaseEntity {
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
