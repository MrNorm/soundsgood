import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class ScrapeHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  showId!: string;

  @Column({ type: "datetime" })
  lastScraped!: Date;

  @Column()
  tracksScraped!: number;
}
