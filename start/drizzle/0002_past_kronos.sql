CREATE TABLE "portfolio_positions" (
	"id" text PRIMARY KEY NOT NULL,
	"asset" text NOT NULL,
	"side" text NOT NULL,
	"entry_price" real NOT NULL,
	"entry_time" integer NOT NULL,
	"size" real NOT NULL,
	"stop" real NOT NULL,
	"target" real NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"exit_price" real,
	"exit_time" integer,
	"exit_reason" text,
	"pnl_pct" real,
	"judgment_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equity" real NOT NULL,
	"total_pnl" real NOT NULL,
	"daily_pnl" real NOT NULL,
	"trade_count" integer NOT NULL,
	"win_count" integer NOT NULL,
	"loss_count" integer NOT NULL,
	"open_position_count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
