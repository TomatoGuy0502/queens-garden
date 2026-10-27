CREATE TABLE "player_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"nickname" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "player_profiles_nickname_idx" ON "player_profiles" USING btree (lower("nickname"));