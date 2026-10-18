CREATE TABLE "application_config" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"applications_open" boolean DEFAULT true NOT NULL,
	"applications_close" timestamp with time zone,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_config_singleton" CHECK ("application_config"."id" = 1),
	CONSTRAINT "application_config_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action
);
