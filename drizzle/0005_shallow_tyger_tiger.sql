CREATE TABLE "referral_claim" (
	"referred_user_id" text PRIMARY KEY NOT NULL,
	"referrer_application_id" uuid NOT NULL,
	"referral_code" text NOT NULL,
	"entry_point" text NOT NULL,
	"clicked_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_claim_entry_point_check" CHECK ("referral_claim"."entry_point" in ('site', 'portal', 'legacy'))
);
--> statement-breakpoint
ALTER TABLE "link_click" ADD COLUMN "entry_point" text;--> statement-breakpoint
ALTER TABLE "referral_claim" ADD CONSTRAINT "referral_claim_referred_user_id_user_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_claim" ADD CONSTRAINT "referral_claim_referrer_application_id_application_id_fk" FOREIGN KEY ("referrer_application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referral_claim_referrer_idx" ON "referral_claim" USING btree ("referrer_application_id");--> statement-breakpoint

-- Preserve every referral the submitted application already credits. This is
-- the higher-priority source when old application and signup attribution differ.
INSERT INTO "referral_claim" (
	"referred_user_id",
	"referrer_application_id",
	"referral_code",
	"entry_point",
	"clicked_at"
)
SELECT referred."user_id",
	referrer."id",
	referred."utm_content",
	'legacy',
	coalesce(referred."first_touch_at", referred."created_at")
FROM "application" referred
JOIN "application" referrer
	ON referrer."referral_code" = referred."utm_content"
	AND referrer."submitted_at" IS NOT NULL
WHERE referred."utm_source" = 'ref'
	AND referred."utm_content" IS NOT NULL
	AND referred."user_id" <> referrer."user_id"
ON CONFLICT ("referred_user_id") DO NOTHING;--> statement-breakpoint

-- Recover referral claims captured at draft time but lost or replaced when the
-- person later submitted from another browser. Draft claims are included now
-- and begin counting only after their application is submitted.
INSERT INTO "referral_claim" (
	"referred_user_id",
	"referrer_application_id",
	"referral_code",
	"entry_point",
	"clicked_at"
)
SELECT attribution."user_id",
	referrer."id",
	attribution."utm_content",
	'legacy',
	coalesce(attribution."first_touch_at", attribution."created_at")
FROM "user_attribution" attribution
JOIN "application" referred
	ON referred."user_id" = attribution."user_id"
JOIN "application" referrer
	ON referrer."referral_code" = attribution."utm_content"
	AND referrer."submitted_at" IS NOT NULL
WHERE attribution."utm_source" = 'ref'
	AND attribution."utm_content" IS NOT NULL
	AND attribution."user_id" <> referrer."user_id"
ON CONFLICT ("referred_user_id") DO NOTHING;
