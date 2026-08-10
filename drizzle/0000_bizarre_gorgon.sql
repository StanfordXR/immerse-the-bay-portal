CREATE TYPE "public"."application_stage" AS ENUM('draft', 'submitted', 'r1_queued', 'r1_done', 'r2_queued', 'r2_done', 'decided');--> statement-breakpoint
CREATE TYPE "public"."decision_kind" AS ENUM('accepted', 'waitlisted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."rsvp_state" AS ENUM('pending', 'confirmed', 'declined', 'expired');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"form_version" integer DEFAULT 1 NOT NULL,
	"first_name" text,
	"last_name" text,
	"date_of_birth" date,
	"school_name" text,
	"school_country" text,
	"school_region" text,
	"grad_year" smallint,
	"hackathons_bucket" text,
	"first_hackathon" boolean,
	"primary_skill" text,
	"portfolio_url" text,
	"tshirt_size" text,
	"dietary_needs" text,
	"accessibility_needs" text,
	"resume_url" text,
	"sponsor_share_ok" boolean DEFAULT false NOT NULL,
	"heard_about_us" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"referrer" text,
	"landing_path" text,
	"first_touch_at" timestamp with time zone,
	"stage" "application_stage" DEFAULT 'draft' NOT NULL,
	"queue_seed" double precision DEFAULT random() NOT NULL,
	"target_reviews" smallint DEFAULT 2 NOT NULL,
	"coverage" smallint DEFAULT 0 NOT NULL,
	"r1_score" numeric(6, 3),
	"r1_spread" numeric(6, 3),
	"r1_rank" integer,
	"decision" "decision_kind",
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"rsvp" "rsvp_state",
	"rsvp_deadline" timestamp with time zone,
	"rsvp_at" timestamp with time zone,
	"checked_in_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid,
	"actor_id" text,
	"actor_kind" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_click" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"referrer" text,
	"user_agent" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_attribution" (
	"user_id" text PRIMARY KEY NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"referrer" text,
	"landing_path" text,
	"first_touch_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_event" ADD CONSTRAINT "application_event_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_event" ADD CONSTRAINT "application_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_attribution" ADD CONSTRAINT "user_attribution_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "application_user_unique" ON "application" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "application_stage_idx" ON "application" USING btree ("stage","submitted_at");--> statement-breakpoint
CREATE INDEX "application_attribution_idx" ON "application" USING btree ("utm_source","utm_medium");--> statement-breakpoint
CREATE INDEX "application_decision_idx" ON "application" USING btree ("decision","rsvp");--> statement-breakpoint
CREATE INDEX "application_event_app_idx" ON "application_event" USING btree ("application_id","at");--> statement-breakpoint
CREATE INDEX "application_event_kind_idx" ON "application_event" USING btree ("kind","at");--> statement-breakpoint
CREATE INDEX "link_click_code_idx" ON "link_click" USING btree ("code","at");