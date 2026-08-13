CREATE TYPE "public"."agent_mode" AS ENUM('live', 'paper', 'simulation');--> statement-breakpoint
CREATE TYPE "public"."conviction" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."decision_action" AS ENUM('long', 'short', 'no_trade');--> statement-breakpoint
CREATE TYPE "public"."evidence_category" AS ENUM('regime', 'volume_profile', 'orderflow', 'price_level', 'liquidity', 'tape', 'volatility', 'funding', 'open_interest');--> statement-breakpoint
CREATE TYPE "public"."evidence_stance" AS ENUM('supporting', 'contradicting');--> statement-breakpoint
CREATE TYPE "public"."execution_status" AS ENUM('pending', 'filled', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."outcome_status" AS ENUM('win', 'loss', 'breakeven', 'invalidated', 'expired');--> statement-breakpoint
CREATE TABLE "agent_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"circle_wallet_id" text,
	"circle_wallet_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_wallets_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"mode" "agent_mode" DEFAULT 'paper' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"version" text DEFAULT 'v1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action" "decision_action" NOT NULL,
	"asset" text NOT NULL,
	"entry" real,
	"stop" real,
	"target" real,
	"invalidation" text,
	"conviction" "conviction" NOT NULL,
	"thesis" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"category" "evidence_category" NOT NULL,
	"title" text NOT NULL,
	"value" text NOT NULL,
	"stance" "evidence_stance" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"executed_price" real NOT NULL,
	"executed_at" timestamp with time zone NOT NULL,
	"tx_hash" text,
	"status" "execution_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"status" "outcome_status" NOT NULL,
	"exit_price" real,
	"pnl" real,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outcomes_execution_id_unique" UNIQUE("execution_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"address" text NOT NULL,
	"first_seen_at" timestamp NOT NULL,
	CONSTRAINT "wallets_address_unique" UNIQUE("address")
);
--> statement-breakpoint
ALTER TABLE "agent_wallets" ADD CONSTRAINT "agent_wallets_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decisions_agent_id_idx" ON "decisions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "decisions_decided_at_idx" ON "decisions" USING btree ("decided_at");--> statement-breakpoint
CREATE INDEX "evidence_decision_id_idx" ON "evidence" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "executions_decision_id_idx" ON "executions" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "wallets_user_id_idx" ON "wallets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wallets_address_lower_idx" ON "wallets" USING btree (LOWER("address"));