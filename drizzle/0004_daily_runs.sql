CREATE TABLE "daily_runs" (
	"user_id" text NOT NULL,
	"day" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"seconds" integer,
	"moves" integer,
	"hints" integer,
	"score" integer,
	CONSTRAINT "daily_runs_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE INDEX "daily_runs_rank_idx" ON "daily_runs" USING btree ("day","score","moves","finished_at");