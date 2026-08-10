ALTER TABLE "application" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "referral_anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_referral_code_unique" UNIQUE("referral_code");