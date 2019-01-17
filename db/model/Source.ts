import {Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToOne, JoinColumn} from "typeorm"
import { Dataset } from './Dataset'

@Entity("sources")
export class Source extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column() datasetId!: number
    @Column() name!: string
    @Column({ default: "{}", type: 'json' }) description!: any

    @ManyToOne(type => Dataset, dataset => dataset.variables) @JoinColumn({ name: 'datasetId' })
    dataset!: Dataset

    // To datapackage json format
    toDatapackage(): any {
        return Object.assign({}, { name: this.name }, this.description)
    }
}