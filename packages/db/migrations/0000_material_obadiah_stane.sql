CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"actor" uuid,
	"accion" text NOT NULL,
	"clave" text DEFAULT '' NOT NULL,
	"esc" text DEFAULT '' NOT NULL,
	"antes" jsonb,
	"despues" jsonb,
	"nota" text DEFAULT '' NOT NULL,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "autoevaluations" (
	"escuela" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"fabrica" boolean DEFAULT false NOT NULL,
	"upload_id" uuid,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "autoevaluations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "catalog_docs" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_docs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decision_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"t" text NOT NULL,
	"key" text NOT NULL,
	"esc" text NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"ind" text,
	"per" text,
	"val" double precision,
	"fuente" text DEFAULT '' NOT NULL,
	"corte" text DEFAULT '' NOT NULL,
	"nota" text DEFAULT '' NOT NULL,
	"anulado" boolean DEFAULT false NOT NULL,
	"proc" text,
	"ficha" text,
	"dueno" text DEFAULT '' NOT NULL,
	"ts" timestamp (3) with time zone NOT NULL,
	"autor" uuid NOT NULL,
	CONSTRAINT "decision_entries_t_chk" CHECK ("decision_entries"."t" in ('v','p')),
	CONSTRAINT "decision_entries_esc_chk" CHECK ("decision_entries"."esc" in ('ENF','OBS','TM')),
	CONSTRAINT "decision_entries_fuente_chk" CHECK ("decision_entries"."t" <> 'v' or "decision_entries"."anulado" or btrim("decision_entries"."fuente") <> '')
);
--> statement-breakpoint
ALTER TABLE "decision_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decision_validations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"entry_ts" timestamp (3) with time zone NOT NULL,
	"estado" text NOT NULL,
	"nota" text DEFAULT '' NOT NULL,
	"by" uuid NOT NULL,
	"ts" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "decision_validations_estado_chk" CHECK ("decision_validations"."estado" in ('Validado','Observado'))
);
--> statement-breakpoint
ALTER TABLE "decision_validations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "evidence_status" (
	"escuela" text NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"ev" text NOT NULL,
	"estado" text NOT NULL,
	"ubicacion" text DEFAULT '' NOT NULL,
	"responsable" text DEFAULT '' NOT NULL,
	"fecha" text DEFAULT '' NOT NULL,
	"observacion" text DEFAULT '' NOT NULL,
	"upload_id" uuid NOT NULL,
	CONSTRAINT "evidence_status_upload_id_escuela_area_ev_pk" PRIMARY KEY("upload_id","escuela","area","ev")
);
--> statement-breakpoint
ALTER TABLE "evidence_status" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "measurements" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"upload_id" uuid NOT NULL,
	"fila" integer DEFAULT 0 NOT NULL,
	"periodo" text NOT NULL,
	"escuela" text NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"indicador" text NOT NULL,
	"numerador" double precision,
	"denominador" double precision,
	"valor_directo" double precision,
	"meta_propuesta" double precision,
	"fuente_meta" text DEFAULT '' NOT NULL,
	"esperado" double precision,
	"fuente_esperado" text DEFAULT '' NOT NULL,
	"fuente_dato" text NOT NULL,
	"ev" text DEFAULT '' NOT NULL,
	"ev_ref" text DEFAULT '' NOT NULL,
	"cargado_por" text DEFAULT '' NOT NULL,
	"fecha_carga" text DEFAULT '' NOT NULL,
	"estado_val" text DEFAULT 'Borrador' NOT NULL,
	"validado_por" text DEFAULT '' NOT NULL,
	"fecha_val" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"obs" text DEFAULT '' NOT NULL,
	"archivo" text DEFAULT '' NOT NULL,
	CONSTRAINT "measurements_fuente_chk" CHECK (btrim("measurements"."fuente_dato") <> ''),
	CONSTRAINT "measurements_periodo_chk" CHECK ("measurements"."periodo" ~ '^[0-9]{4}(-(S[12]|T[1-4]|0[1-9]|1[0-2]))?$'),
	CONSTRAINT "measurements_escuela_chk" CHECK ("measurements"."escuela" in ('ENF','OBS','TM','FAC'))
);
--> statement-breakpoint
ALTER TABLE "measurements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "parameter_sets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"fecha" text NOT NULL,
	"origen" text NOT NULL,
	"gen" jsonb NOT NULL,
	"reglas" jsonb NOT NULL,
	"metas" jsonb NOT NULL,
	"nota" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parameter_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"nombre" text NOT NULL,
	"rol" text NOT NULL,
	"escuela" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_rol_chk" CHECK ("profiles"."rol" in ('admin','oficina','responsable','lectura')),
	CONSTRAINT "profiles_escuela_chk" CHECK ("profiles"."escuela" is null or "profiles"."escuela" in ('ENF','OBS','TM')),
	CONSTRAINT "profiles_responsable_escuela_chk" CHECK ("profiles"."rol" <> 'responsable' or "profiles"."escuela" is not null)
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "school_scope" (
	"escuela" text NOT NULL,
	"indicador_id" text NOT NULL,
	"en_seguimiento" text DEFAULT '' NOT NULL,
	"responsable_local" text DEFAULT '' NOT NULL,
	"upload_id" uuid NOT NULL,
	CONSTRAINT "school_scope_upload_id_escuela_indicador_id_pk" PRIMARY KEY("upload_id","escuela","indicador_id")
);
--> statement-breakpoint
ALTER TABLE "school_scope" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "upload_rejections" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"upload_id" uuid NOT NULL,
	"fila" integer DEFAULT 0 NOT NULL,
	"escuela" text NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"indicador" text DEFAULT '' NOT NULL,
	"periodo" text DEFAULT '' NOT NULL,
	"motivo" text NOT NULL,
	"fecha_carga" text DEFAULT '' NOT NULL,
	"fila_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "upload_rejections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"sha256" text NOT NULL,
	"size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"kind" text NOT NULL,
	"escuela" text,
	"version_plantilla" text DEFAULT '' NOT NULL,
	"responsable" text DEFAULT '' NOT NULL,
	"entrega" text DEFAULT '' NOT NULL,
	"resumen" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"advertencias" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uploads_kind_chk" CHECK ("uploads"."kind" in ('carga','consolidado','parametros'))
);
--> statement-breakpoint
ALTER TABLE "uploads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_profiles_id_fk" FOREIGN KEY ("actor") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autoevaluations" ADD CONSTRAINT "autoevaluations_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_entries" ADD CONSTRAINT "decision_entries_autor_profiles_id_fk" FOREIGN KEY ("autor") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_validations" ADD CONSTRAINT "decision_validations_by_profiles_id_fk" FOREIGN KEY ("by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_status" ADD CONSTRAINT "evidence_status_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parameter_sets" ADD CONSTRAINT "parameter_sets_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_scope" ADD CONSTRAINT "school_scope_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_rejections" ADD CONSTRAINT "upload_rejections_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_ts_idx" ON "audit_log" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "decision_entries_key_idx" ON "decision_entries" USING btree ("key","ts");--> statement-breakpoint
CREATE INDEX "decision_validations_key_idx" ON "decision_validations" USING btree ("key");--> statement-breakpoint
CREATE INDEX "measurements_upload_idx" ON "measurements" USING btree ("upload_id");--> statement-breakpoint
CREATE INDEX "measurements_clave_idx" ON "measurements" USING btree ("escuela","indicador","periodo");--> statement-breakpoint
CREATE UNIQUE INDEX "parameter_sets_version_uq" ON "parameter_sets" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_email_uq" ON "profiles" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_un_responsable_por_escuela" ON "profiles" USING btree ("escuela") WHERE "profiles"."rol" = 'responsable' and "profiles"."activo";--> statement-breakpoint
CREATE INDEX "upload_rejections_upload_idx" ON "upload_rejections" USING btree ("upload_id");--> statement-breakpoint
CREATE INDEX "uploads_created_idx" ON "uploads" USING btree ("created_at");