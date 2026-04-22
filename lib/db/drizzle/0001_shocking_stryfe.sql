CREATE TABLE "award_shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"award_id" integer NOT NULL,
	"shop_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attribute_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"attribute_id" integer NOT NULL,
	"name" jsonb,
	"status" text DEFAULT 'show'
);
--> statement-breakpoint
CREATE TABLE "attributes" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" jsonb NOT NULL,
	"name" jsonb NOT NULL,
	"input_type" text,
	"type" text DEFAULT 'attribute',
	"status" text DEFAULT 'show',
	"sync" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_no" text,
	"total_amount" numeric(14, 2),
	"balance" numeric(14, 2),
	"mpesa_code" text,
	"payment_type" text,
	"type" text NOT NULL,
	"shop_id" integer,
	"processed_by_id" integer,
	"customer_id" integer,
	"supplier_id" integer,
	"admin_id" integer,
	"sync" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_payments_payment_no_unique" UNIQUE("payment_no")
);
--> statement-breakpoint
ALTER TABLE "award_shops" ADD CONSTRAINT "award_shops_award_id_awards_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."awards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_variants" ADD CONSTRAINT "attribute_variants_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_payments" ADD CONSTRAINT "user_payments_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_payments" ADD CONSTRAINT "user_payments_processed_by_id_attendants_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "public"."attendants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_payments" ADD CONSTRAINT "user_payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_payments" ADD CONSTRAINT "user_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_payments" ADD CONSTRAINT "user_payments_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_payments_shop_id_idx" ON "user_payments" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "user_payments_customer_id_idx" ON "user_payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "user_payments_supplier_id_idx" ON "user_payments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "user_payments_shop_date_idx" ON "user_payments" USING btree ("shop_id","created_at");