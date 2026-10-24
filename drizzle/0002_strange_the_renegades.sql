CREATE TABLE "puzzle_catalog" (
	"hash" text PRIMARY KEY NOT NULL,
	"generator_version" text NOT NULL,
	"validation_version" text NOT NULL,
	"size" integer NOT NULL,
	"difficulty" text NOT NULL,
	"payload" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"use_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "puzzle_recipes" (
	"key" text PRIMARY KEY NOT NULL,
	"board_hash" text NOT NULL,
	"replay" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "puzzle_recipes" ADD CONSTRAINT "puzzle_recipes_board_hash_puzzle_catalog_hash_fk" FOREIGN KEY ("board_hash") REFERENCES "public"."puzzle_catalog"("hash") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "puzzle_catalog_stock_idx" ON "puzzle_catalog" USING btree ("generator_version","validation_version","size","difficulty","enabled","use_count","created_at");