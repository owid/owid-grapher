import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity("sources")
export class Source extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column() datasetId!: number
    @Column() name!: string
    @Column({ default: "{}", type: "json" }) description!: any

    // To datapackage json format
    toDatapackage(): any {
        return Object.assign({}, { name: this.name }, this.description)
    }
}
