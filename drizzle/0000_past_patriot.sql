CREATE TABLE "curio_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"json_schema" jsonb NOT NULL,
	"public_field_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extraction_prompt" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_entity_id" uuid,
	"url_hash" text NOT NULL,
	"entity_key" text NOT NULL,
	"canonical_url" text NOT NULL,
	"core_type" varchar(32) NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"hero_image_url" text,
	"core_structured_data" jsonb NOT NULL,
	"extended_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ucp_sku_id" text,
	"price_cents" integer,
	"currency" varchar(3) DEFAULT 'USD',
	"price_verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"save_id" uuid NOT NULL,
	"position_index" integer DEFAULT 0 NOT NULL,
	"section_header" text,
	"curator_note" text,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smart_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"is_paywalled" boolean DEFAULT false NOT NULL,
	"access_price_cents" integer,
	"auto_rules" jsonb,
	"external_sync_target" varchar(32) DEFAULT 'NONE',
	"visibility" varchar(32) DEFAULT 'PRIVATE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_saves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_id" uuid,
	"custom_type_id" uuid,
	"is_private_memo" boolean DEFAULT false NOT NULL,
	"private_title" text,
	"personal_notes" text,
	"user_custom_values" jsonb DEFAULT '{}'::jsonb,
	"candidate_fallbacks" jsonb DEFAULT '[]'::jsonb,
	"auto_tags" jsonb DEFAULT '[]'::jsonb,
	"has_converted_purchase" boolean DEFAULT false NOT NULL,
	"enrichment_status" varchar(32) DEFAULT 'ENRICHED' NOT NULL,
	"visibility" varchar(32) DEFAULT 'PRIVATE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" varchar(32) NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"is_pro" boolean DEFAULT false NOT NULL,
	"ai_credits_remaining" integer DEFAULT 25 NOT NULL,
	"ai_credits_reset_at" timestamp DEFAULT now() NOT NULL,
	"custom_domain" text,
	"affiliate_tags" jsonb,
	"google_sync_tokens" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "curio_types" ADD CONSTRAINT "curio_types_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_id_smart_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."smart_lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_save_id_user_saves_id_fk" FOREIGN KEY ("save_id") REFERENCES "public"."user_saves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_lists" ADD CONSTRAINT "smart_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saves" ADD CONSTRAINT "user_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saves" ADD CONSTRAINT "user_saves_entity_id_global_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."global_entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saves" ADD CONSTRAINT "user_saves_custom_type_id_curio_types_id_fk" FOREIGN KEY ("custom_type_id") REFERENCES "public"."curio_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_global_entities_entity_key" ON "global_entities" USING btree ("entity_key");--> statement-breakpoint
CREATE INDEX "idx_global_entities_url_hash" ON "global_entities" USING btree ("url_hash");--> statement-breakpoint
CREATE INDEX "idx_global_entities_parent_id" ON "global_entities" USING btree ("parent_entity_id");--> statement-breakpoint
CREATE INDEX "idx_global_entities_price_cents" ON "global_entities" USING btree ("price_cents");--> statement-breakpoint
CREATE INDEX "idx_list_items_list_order" ON "list_items" USING btree ("list_id","position_index");--> statement-breakpoint
CREATE INDEX "idx_user_saves_user_id" ON "user_saves" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_saves_entity_id" ON "user_saves" USING btree ("entity_id");