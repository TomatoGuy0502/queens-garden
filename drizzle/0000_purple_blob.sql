CREATE TABLE "coop_room_events" (
	"room_id" text NOT NULL,
	"revision" integer NOT NULL,
	"event" jsonb NOT NULL,
	CONSTRAINT "coop_room_events_room_id_revision_pk" PRIMARY KEY("room_id","revision")
);
--> statement-breakpoint
CREATE TABLE "coop_rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coop_room_events" ADD CONSTRAINT "coop_room_events_room_id_coop_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."coop_rooms"("id") ON DELETE cascade ON UPDATE no action;