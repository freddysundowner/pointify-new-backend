CREATE TABLE "measures" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "measures_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"values" text[] DEFAULT '{}' NOT NULL,
	"condition" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"setting" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settings_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "shop_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"username" text,
	"password" text NOT NULL,
	"attendant_id" integer,
	"primary_shop_id" integer,
	"affiliate_id" integer,
	"referred_by_id" integer,
	"referral_credit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"otp" text,
	"otp_expiry" bigint,
	"email_verified" boolean DEFAULT false NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"email_verification_date" timestamp,
	"sms_credit" integer DEFAULT 0 NOT NULL,
	"sale_sms_enabled" boolean DEFAULT false NOT NULL,
	"auto_print" boolean DEFAULT true NOT NULL,
	"platform" text,
	"app_version" text,
	"last_seen" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "attendants" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"pin" text,
	"password" text,
	"permissions" text[],
	"admin_id" integer NOT NULL,
	"shop_id" integer,
	"last_seen" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"receipt_header" text,
	"shop_category_id" integer,
	"admin_id" integer,
	"subscription_id" integer,
	"location_lat" real DEFAULT 0 NOT NULL,
	"location_lng" real DEFAULT 0 NOT NULL,
	"currency" text,
	"contact" text,
	"tax_rate" numeric(6, 2) DEFAULT '0' NOT NULL,
	"paybill_till" text,
	"paybill_account" text,
	"receipt_email" text DEFAULT '' NOT NULL,
	"backup_email" text,
	"backup_interval" text,
	"backup_date" timestamp,
	"show_stock_online" boolean DEFAULT false NOT NULL,
	"show_price_online" boolean DEFAULT false NOT NULL,
	"warehouse" boolean DEFAULT false NOT NULL,
	"production" boolean DEFAULT false NOT NULL,
	"allow_backup" boolean DEFAULT true NOT NULL,
	"track_batches" boolean DEFAULT false NOT NULL,
	"online_selling" boolean DEFAULT true NOT NULL,
	"negative_selling" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"package_id" integer NOT NULL,
	"feature" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"duration_value" integer NOT NULL,
	"duration_unit" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"amount_usd" numeric(14, 2) NOT NULL,
	"discount" numeric(6, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"type" text NOT NULL,
	"shops" integer
);
--> statement-breakpoint
CREATE TABLE "subscription_shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"shop_id" integer NOT NULL,
	CONSTRAINT "subscription_shops_unique" UNIQUE("subscription_id","shop_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"package_id" integer NOT NULL,
	"payment_reference" text,
	"amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"invoice_no" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"currency" text DEFAULT 'kes' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_invoice_no_unique" UNIQUE("invoice_no")
);
--> statement-breakpoint
CREATE TABLE "affiliate_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"affiliate_amount" numeric(14, 2),
	"balance" numeric(14, 2) NOT NULL,
	"trans_id" text,
	"payment_reference" text,
	"type" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"affiliate_id" integer NOT NULL,
	"admin_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text NOT NULL,
	"address" text,
	"country" text,
	"password" text NOT NULL,
	"commission" numeric(10, 2) DEFAULT '20' NOT NULL,
	"wallet" numeric(14, 2) DEFAULT '0' NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"code" text NOT NULL,
	"otp" text,
	"otp_expiry" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "affiliates_email_unique" UNIQUE("email"),
	CONSTRAINT "affiliates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "awards" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer,
	"affiliate_id" integer NOT NULL,
	"shop_id" integer,
	"from_admin_id" integer,
	"amount" numeric(14, 2),
	"commission_amount" numeric(14, 2),
	"payment_no" text,
	"payment_reference" text,
	"currency" text DEFAULT 'kes' NOT NULL,
	"type" text NOT NULL,
	"award_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "awards_payment_no_unique" UNIQUE("payment_no")
);
--> statement-breakpoint
CREATE TABLE "customer_wallet_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"shop_id" integer NOT NULL,
	"handled_by_id" integer,
	"type" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"balance" numeric(14, 2) NOT NULL,
	"payment_no" text,
	"payment_reference" text,
	"payment_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_no" integer,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"password" text,
	"otp" text,
	"otp_expiry" bigint,
	"type" text,
	"credit_limit" numeric(14, 2),
	"wallet" numeric(14, 2) DEFAULT '0' NOT NULL,
	"outstanding_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"shop_id" integer NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_no_shop_unique" UNIQUE("customer_no","shop_id")
);
--> statement-breakpoint
CREATE TABLE "supplier_wallet_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"shop_id" integer NOT NULL,
	"handled_by_id" integer,
	"type" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"balance" numeric(14, 2) NOT NULL,
	"payment_no" text,
	"payment_reference" text,
	"payment_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"wallet" numeric(14, 2) DEFAULT '0' NOT NULL,
	"outstanding_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"shop_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"shop_id" integer NOT NULL,
	"adjusted_by_id" integer NOT NULL,
	"type" text DEFAULT 'add' NOT NULL,
	"quantity_before" numeric(14, 4) NOT NULL,
	"quantity_after" numeric(14, 4) NOT NULL,
	"quantity_adjusted" numeric(14, 4) NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bad_stocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"shop_id" integer NOT NULL,
	"written_off_by_id" integer NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"shop_id" integer NOT NULL,
	"buying_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"quantity" numeric(14, 4) DEFAULT '0' NOT NULL,
	"total_quantity" numeric(14, 4) DEFAULT '0' NOT NULL,
	"expiration_date" timestamp,
	"batch_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "batches_batch_code_unique" UNIQUE("batch_code")
);
--> statement-breakpoint
CREATE TABLE "bundle_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"component_product_id" integer NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bundle_items_product_component_unique" UNIQUE("product_id","component_product_id")
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"shop_id" integer NOT NULL,
	"updated_by_id" integer,
	"quantity" numeric(14, 4) DEFAULT '0' NOT NULL,
	"reorder_level" numeric(14, 4) DEFAULT '0' NOT NULL,
	"last_count" numeric(14, 4) DEFAULT '0' NOT NULL,
	"last_count_date" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_product_shop_unique" UNIQUE("product_id","shop_id")
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"admin_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_serials" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"shop_id" integer NOT NULL,
	"serial_number" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_serials_number_shop_unique" UNIQUE("serial_number","shop_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"buying_price" numeric(14, 2),
	"selling_price" numeric(14, 2),
	"wholesale_price" numeric(14, 2),
	"dealer_price" numeric(14, 2),
	"min_selling_price" numeric(14, 2),
	"max_discount" numeric(14, 2),
	"product_category_id" integer,
	"measure_unit" text DEFAULT '' NOT NULL,
	"manufacturer" text DEFAULT '' NOT NULL,
	"supplier_id" integer,
	"shop_id" integer NOT NULL,
	"created_by_id" integer NOT NULL,
	"description" text,
	"thumbnail_url" text,
	"images" text[] DEFAULT '{}' NOT NULL,
	"barcode" text,
	"sku" text,
	"product_type" text DEFAULT 'product' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"manage_by_price" boolean DEFAULT false NOT NULL,
	"is_taxable" boolean DEFAULT false NOT NULL,
	"expiry_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_count_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_count_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"physical_count" numeric(14, 4) NOT NULL,
	"system_count" numeric(14, 4) NOT NULL,
	"variance" numeric(14, 4) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_count_items_count_product_unique" UNIQUE("stock_count_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "stock_counts" (
	"id" serial PRIMARY KEY NOT NULL,
	"conducted_by_id" integer NOT NULL,
	"shop_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_request_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_request_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity_requested" numeric(14, 4) NOT NULL,
	"quantity_received" numeric(14, 4) DEFAULT '0' NOT NULL,
	CONSTRAINT "stock_request_items_request_product_unique" UNIQUE("stock_request_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "stock_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"requested_by_id" integer NOT NULL,
	"accepted_by_id" integer,
	"approved_by_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"from_shop_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"total_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"invoice_number" text,
	"accepted_at" timestamp,
	"dispatched_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_requests_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_no" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"order_note" text,
	"shop_id" integer NOT NULL,
	"customer_id" integer,
	"attendant_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "sale_item_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_item_id" integer NOT NULL,
	"batch_id" integer NOT NULL,
	"quantity_taken" numeric(14, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"attendant_id" integer,
	"serial_id" integer,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"cost_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_discount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sale_note" text,
	"sale_type" text DEFAULT 'Retail' NOT NULL,
	"status" text DEFAULT 'cashed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"received_by_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"payment_no" text,
	"payment_reference" text,
	"payment_type" text NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_return_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_return_id" integer NOT NULL,
	"sale_item_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"customer_id" integer,
	"processed_by_id" integer NOT NULL,
	"shop_id" integer NOT NULL,
	"refund_amount" numeric(14, 2) NOT NULL,
	"refund_method" text NOT NULL,
	"refund_reference" text,
	"reason" text,
	"return_no" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sale_returns_return_no_unique" UNIQUE("return_no")
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_no" text,
	"total_amount" numeric(14, 2) NOT NULL,
	"total_with_discount" numeric(14, 2) NOT NULL,
	"total_tax" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sale_discount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"mpesa_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"bank_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"card_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"outstanding_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sale_type" text DEFAULT 'Retail' NOT NULL,
	"payment_type" text DEFAULT 'cash' NOT NULL,
	"status" text DEFAULT 'cashed' NOT NULL,
	"sale_note" text,
	"due_date" timestamp,
	"shop_id" integer NOT NULL,
	"customer_id" integer,
	"attendant_id" integer,
	"order_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sales_receipt_no_unique" UNIQUE("receipt_no")
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"line_discount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"batch_code" text,
	"expiry_date" timestamp,
	"batch_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_id" integer NOT NULL,
	"paid_by_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"payment_no" text,
	"payment_reference" text,
	"payment_type" text NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_return_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_return_id" integer NOT NULL,
	"purchase_item_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_id" integer NOT NULL,
	"supplier_id" integer,
	"processed_by_id" integer NOT NULL,
	"shop_id" integer NOT NULL,
	"refund_amount" numeric(14, 2) NOT NULL,
	"refund_method" text NOT NULL,
	"refund_reference" text,
	"reason" text,
	"return_no" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_returns_return_no_unique" UNIQUE("return_no")
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_no" text,
	"total_amount" numeric(14, 2) NOT NULL,
	"amount_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"outstanding_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"payment_type" text NOT NULL,
	"shop_id" integer NOT NULL,
	"supplier_id" integer,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_purchase_no_unique" UNIQUE("purchase_no")
);
--> statement-breakpoint
CREATE TABLE "product_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_no" text,
	"transfer_note" text,
	"initiated_by_id" integer NOT NULL,
	"from_shop_id" integer NOT NULL,
	"to_shop_id" integer NOT NULL,
	"purchase_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_transfers_transfer_no_unique" UNIQUE("transfer_no")
);
--> statement-breakpoint
CREATE TABLE "transfer_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_price" numeric(14, 2)
);
--> statement-breakpoint
CREATE TABLE "banks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"shop_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cashflow_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"shop_id" integer,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cashflows" (
	"id" serial PRIMARY KEY NOT NULL,
	"cashflow_no" text,
	"description" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"category_id" integer,
	"recorded_by_id" integer NOT NULL,
	"shop_id" integer NOT NULL,
	"bank_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cashflows_cashflow_no_unique" UNIQUE("cashflow_no")
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"shop_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"expense_no" text,
	"description" text,
	"amount" numeric(14, 2) NOT NULL,
	"shop_id" integer NOT NULL,
	"recorded_by_id" integer NOT NULL,
	"category_id" integer,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"frequency" text,
	"next_occurrence_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_expense_no_unique" UNIQUE("expense_no")
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"shop_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"details" text,
	"shop_id" integer NOT NULL,
	"attendant_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communications" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer,
	"message" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"type" text DEFAULT 'sms' NOT NULL,
	"contact" text NOT NULL,
	"failed_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"is_scheduled" boolean DEFAULT false NOT NULL,
	"interval" text DEFAULT 'monthly' NOT NULL,
	"campaign" text,
	"type" text DEFAULT 'email' NOT NULL,
	"audience" text DEFAULT 'custom' NOT NULL,
	"audience_emails" text DEFAULT '' NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"html_content" text NOT NULL,
	"category" text NOT NULL,
	"placeholders" text[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "email_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "emails_sent" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer,
	"subject" text NOT NULL,
	"email_template_id" integer,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"description" text,
	"communication_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_shop_category_id_shop_categories_id_fk" FOREIGN KEY ("shop_category_id") REFERENCES "public"."shop_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_features" ADD CONSTRAINT "package_features_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_shops" ADD CONSTRAINT "subscription_shops_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_shops" ADD CONSTRAINT "subscription_shops_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_transactions" ADD CONSTRAINT "affiliate_transactions_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_transactions" ADD CONSTRAINT "affiliate_transactions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_from_admin_id_admins_id_fk" FOREIGN KEY ("from_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wallet_transactions" ADD CONSTRAINT "customer_wallet_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wallet_transactions" ADD CONSTRAINT "customer_wallet_transactions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wallet_transactions" ADD CONSTRAINT "customer_wallet_transactions_handled_by_id_attendants_id_fk" FOREIGN KEY ("handled_by_id") REFERENCES "public"."attendants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_id_attendants_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."attendants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_wallet_transactions" ADD CONSTRAINT "supplier_wallet_transactions_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_wallet_transactions" ADD CONSTRAINT "supplier_wallet_transactions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_wallet_transactions" ADD CONSTRAINT "supplier_wallet_transactions_handled_by_id_attendants_id_fk" FOREIGN KEY ("handled_by_id") REFERENCES "public"."attendants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_adjusted_by_id_attendants_id_fk" FOREIGN KEY ("adjusted_by_id") REFERENCES "public"."attendants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bad_stocks" ADD CONSTRAINT "bad_stocks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bad_stocks" ADD CONSTRAINT "bad_stocks_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bad_stocks" ADD CONSTRAINT "bad_stocks_written_off_by_id_attendants_id_fk" FOREIGN KEY ("written_off_by_id") REFERENCES "public"."attendants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_component_product_id_products_id_fk" FOREIGN KEY ("component_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_updated_by_id_attendants_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."attendants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_serials" ADD CONSTRAINT "product_serials_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_serials" ADD CONSTRAINT "product_serials_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_product_category_id_product_categories_id_fk" FOREIGN KEY ("product_category_id") REFERENCES "public"."product_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_id_attendants_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."attendants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_stock_count_id_stock_counts_id_fk" FOREIGN KEY ("stock_count_id") REFERENCES "public"."stock_counts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_conducted_by_id_attendants_id_fk" FOREIGN KEY ("conducted_by_id") REFERENCES "public"."attendants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_request_items" ADD CONSTRAINT "stock_request_items_stock_request_id_stock_requests_id_fk" FOREIGN KEY ("stock_request_id") REFERENCES "public"."stock_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_request_items" ADD CONSTRAINT "stock_request_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_requested_by_id_attendants_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."attendants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_accepted_by_id_attendants_id_fk" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."attendants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_approved_by_id_attendants_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."attendants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_from_shop_id_shops_id_fk" FOREIGN KEY ("from_shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_warehouse_id_shops_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_attendant_id_attendants_id_fk" FOREIGN KEY ("attendant_id") REFERENCES "public"."attendants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item_batches" ADD CONSTRAINT "sale_item_batches_sale_item_id_sale_items_id_fk" FOREIGN KEY ("sale_item_id") REFERENCES "public"."sale_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item_batches" ADD CONSTRAINT "sale_item_batches_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_attendant_id_attendants_id_fk" FOREIGN KEY ("attendant_id") REFERENCES "public"."attendants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_serial_id_product_serials_id_fk" FOREIGN KEY ("serial_id") REFERENCES "public"."product_serials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_received_by_id_attendants_id_fk" FOREIGN KEY ("received_by_id") REFERENCES "public"."attendants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_sale_return_id_sale_returns_id_fk" FOREIGN KEY ("sale_return_id") REFERENCES "public"."sale_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_sale_item_id_sale_items_id_fk" FOREIGN KEY ("sale_item_id") REFERENCES "public"."sale_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_processed_by_id_attendants_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "public"."attendants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_attendant_id_attendants_id_fk" FOREIGN KEY ("attendant_id") REFERENCES "public"."attendants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_paid_by_id_attendants_id_fk" FOREIGN KEY ("paid_by_id") REFERENCES "public"."attendants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_purchase_return_id_purchase_returns_id_fk" FOREIGN KEY ("purchase_return_id") REFERENCES "public"."purchase_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_purchase_item_id_purchase_items_id_fk" FOREIGN KEY ("purchase_item_id") REFERENCES "public"."purchase_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_processed_by_id_attendants_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "public"."attendants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_id_attendants_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."attendants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_transfers" ADD CONSTRAINT "product_transfers_initiated_by_id_attendants_id_fk" FOREIGN KEY ("initiated_by_id") REFERENCES "public"."attendants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_transfers" ADD CONSTRAINT "product_transfers_from_shop_id_shops_id_fk" FOREIGN KEY ("from_shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_transfers" ADD CONSTRAINT "product_transfers_to_shop_id_shops_id_fk" FOREIGN KEY ("to_shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_transfers" ADD CONSTRAINT "product_transfers_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_transfer_id_product_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."product_transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banks" ADD CONSTRAINT "banks_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashflow_categories" ADD CONSTRAINT "cashflow_categories_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashflows" ADD CONSTRAINT "cashflows_category_id_cashflow_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."cashflow_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashflows" ADD CONSTRAINT "cashflows_recorded_by_id_attendants_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."attendants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashflows" ADD CONSTRAINT "cashflows_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashflows" ADD CONSTRAINT "cashflows_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_id_attendants_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."attendants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_attendant_id_attendants_id_fk" FOREIGN KEY ("attendant_id") REFERENCES "public"."attendants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails_sent" ADD CONSTRAINT "emails_sent_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails_sent" ADD CONSTRAINT "emails_sent_email_template_id_email_messages_id_fk" FOREIGN KEY ("email_template_id") REFERENCES "public"."email_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_credit_transactions" ADD CONSTRAINT "sms_credit_transactions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_credit_transactions" ADD CONSTRAINT "sms_credit_transactions_communication_id_communications_id_fk" FOREIGN KEY ("communication_id") REFERENCES "public"."communications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admins_affiliate_id_idx" ON "admins" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "admins_referred_by_id_idx" ON "admins" USING btree ("referred_by_id");--> statement-breakpoint
CREATE INDEX "attendants_admin_id_idx" ON "attendants" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "attendants_shop_id_idx" ON "attendants" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "shops_admin_id_idx" ON "shops" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "shops_subscription_id_idx" ON "shops" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_shops_shop_id_idx" ON "subscription_shops" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "subscriptions_admin_id_idx" ON "subscriptions" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "subscriptions_end_date_idx" ON "subscriptions" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "affiliate_transactions_affiliate_id_idx" ON "affiliate_transactions" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "affiliate_transactions_created_at_idx" ON "affiliate_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "awards_affiliate_id_idx" ON "awards" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "awards_subscription_id_idx" ON "awards" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "awards_shop_id_idx" ON "awards" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "awards_created_at_idx" ON "awards" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cwt_customer_id_idx" ON "customer_wallet_transactions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "cwt_shop_id_idx" ON "customer_wallet_transactions" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "customers_shop_id_idx" ON "customers" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customers_outstanding_idx" ON "customers" USING btree ("outstanding_balance");--> statement-breakpoint
CREATE INDEX "swt_supplier_id_idx" ON "supplier_wallet_transactions" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "swt_shop_id_idx" ON "supplier_wallet_transactions" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "suppliers_shop_id_idx" ON "suppliers" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "suppliers_outstanding_idx" ON "suppliers" USING btree ("outstanding_balance");--> statement-breakpoint
CREATE INDEX "adjustments_product_shop_idx" ON "adjustments" USING btree ("product_id","shop_id");--> statement-breakpoint
CREATE INDEX "adjustments_created_at_idx" ON "adjustments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bad_stocks_shop_id_idx" ON "bad_stocks" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "bad_stocks_product_id_idx" ON "bad_stocks" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "batches_product_shop_idx" ON "batches" USING btree ("product_id","shop_id");--> statement-breakpoint
CREATE INDEX "batches_expiration_idx" ON "batches" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX "bundle_items_product_idx" ON "bundle_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "bundle_items_component_product_idx" ON "bundle_items" USING btree ("component_product_id");--> statement-breakpoint
CREATE INDEX "inventory_product_shop_idx" ON "inventory" USING btree ("product_id","shop_id");--> statement-breakpoint
CREATE INDEX "product_categories_admin_id_idx" ON "product_categories" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "product_serials_product_idx" ON "product_serials" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_serials_serial_number_idx" ON "product_serials" USING btree ("serial_number");--> statement-breakpoint
CREATE INDEX "products_shop_id_idx" ON "products" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "products_barcode_idx" ON "products" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "products_shop_deleted_idx" ON "products" USING btree ("shop_id","is_deleted");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("product_category_id");--> statement-breakpoint
CREATE INDEX "products_supplier_idx" ON "products" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "stock_count_items_stock_count_idx" ON "stock_count_items" USING btree ("stock_count_id");--> statement-breakpoint
CREATE INDEX "stock_counts_shop_id_idx" ON "stock_counts" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "stock_request_items_request_idx" ON "stock_request_items" USING btree ("stock_request_id");--> statement-breakpoint
CREATE INDEX "stock_requests_from_shop_idx" ON "stock_requests" USING btree ("from_shop_id");--> statement-breakpoint
CREATE INDEX "stock_requests_warehouse_idx" ON "stock_requests" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_requests_status_idx" ON "stock_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_shop_id_idx" ON "orders" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sale_item_batches_sale_item_idx" ON "sale_item_batches" USING btree ("sale_item_id");--> statement-breakpoint
CREATE INDEX "sale_item_batches_batch_id_idx" ON "sale_item_batches" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_items_product_id_idx" ON "sale_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "sale_items_serial_id_idx" ON "sale_items" USING btree ("serial_id");--> statement-breakpoint
CREATE INDEX "sale_payments_sale_id_idx" ON "sale_payments" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_return_items_return_idx" ON "sale_return_items" USING btree ("sale_return_id");--> statement-breakpoint
CREATE INDEX "sale_returns_shop_id_idx" ON "sale_returns" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "sale_returns_sale_id_idx" ON "sale_returns" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sales_shop_id_idx" ON "sales" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "sales_shop_date_idx" ON "sales" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "sales_customer_id_idx" ON "sales" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_attendant_id_idx" ON "sales" USING btree ("attendant_id");--> statement-breakpoint
CREATE INDEX "sales_order_id_idx" ON "sales" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "sales_status_idx" ON "sales" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sales_created_at_idx" ON "sales" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "purchase_items_purchase_id_idx" ON "purchase_items" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "purchase_items_product_id_idx" ON "purchase_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "purchase_items_batch_id_idx" ON "purchase_items" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "purchase_payments_purchase_id_idx" ON "purchase_payments" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "purchase_return_items_return_idx" ON "purchase_return_items" USING btree ("purchase_return_id");--> statement-breakpoint
CREATE INDEX "purchase_returns_shop_id_idx" ON "purchase_returns" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "purchase_returns_purchase_id_idx" ON "purchase_returns" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "purchases_shop_id_idx" ON "purchases" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "purchases_supplier_id_idx" ON "purchases" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchases_created_at_idx" ON "purchases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "product_transfers_from_shop_idx" ON "product_transfers" USING btree ("from_shop_id");--> statement-breakpoint
CREATE INDEX "product_transfers_to_shop_idx" ON "product_transfers" USING btree ("to_shop_id");--> statement-breakpoint
CREATE INDEX "product_transfers_created_at_idx" ON "product_transfers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transfer_items_transfer_id_idx" ON "transfer_items" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "transfer_items_product_id_idx" ON "transfer_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "banks_shop_id_idx" ON "banks" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "cashflow_categories_shop_id_idx" ON "cashflow_categories" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "cashflows_shop_id_idx" ON "cashflows" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "cashflows_shop_date_idx" ON "cashflows" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "cashflows_category_id_idx" ON "cashflows" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "cashflows_bank_id_idx" ON "cashflows" USING btree ("bank_id");--> statement-breakpoint
CREATE INDEX "expense_categories_shop_id_idx" ON "expense_categories" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "expenses_shop_id_idx" ON "expenses" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "expenses_shop_date_idx" ON "expenses" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "expenses_category_id_idx" ON "expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "payment_methods_shop_id_idx" ON "payment_methods" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "activities_shop_id_idx" ON "activities" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "activities_shop_date_idx" ON "activities" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "activities_attendant_id_idx" ON "activities" USING btree ("attendant_id");--> statement-breakpoint
CREATE INDEX "communications_admin_id_idx" ON "communications" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "communications_type_status_idx" ON "communications" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "communications_created_at_idx" ON "communications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sms_credit_tx_admin_id_idx" ON "sms_credit_transactions" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "sms_credit_tx_type_idx" ON "sms_credit_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "sms_credit_tx_created_at_idx" ON "sms_credit_transactions" USING btree ("created_at");