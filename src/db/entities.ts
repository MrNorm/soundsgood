import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from "typeorm";

// ==================
// Episode Entity
// ==================
@Entity("episodes")
export class Episode {
  @PrimaryColumn()
  id!: string;

  @Column()
  showId!: string;

  @Column()
  title!: string;

  @Column({ nullable: true })
  summary!: string;

  @Column()
  airDate!: string;

  @OneToMany(() => Track, (track) => track.episode, { cascade: true })
  tracks!: Track[];
}

// ==================
// Track Entity
// ==================
@Entity("tracks")
export class Track {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => Episode, (episode) => episode.tracks)
  @JoinColumn({ name: "episode_id" })
  episode!: Episode;

  @Column()
  episode_id!: string;

  @Column()
  artist!: string;

  @Column()
  title!: string;

  @Column({ nullable: true })
  url!: string;
}
