import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260909010610 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "conjunto_regra" drop constraint if exists "conjunto_regra_escopo_unique";`);
    this.addSql(`alter table if exists "conjunto_regra" drop constraint if exists "conjunto_regra_collection_id_unique";`);
    this.addSql(`alter table if exists "conjunto_par" drop constraint if exists "conjunto_par_categoria_a_categoria_b_unique";`);
    this.addSql(`alter table if exists "conjunto_curado" drop constraint if exists "conjunto_curado_handle_unique";`);
    this.addSql(`create table if not exists "conjunto_curado" ("id" text not null, "nome" text not null, "handle" text not null, "capa_url" text null, "product_ids" text[] not null, "regra_id" text not null, "ativo" boolean not null default true, "ordem" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "conjunto_curado_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_conjunto_curado_deleted_at" ON "conjunto_curado" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_conjunto_curado_handle_unique" ON "conjunto_curado" ("handle") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "conjunto_par" ("id" text not null, "categoria_a" text not null, "categoria_b" text not null, "ativo" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "conjunto_par_pkey" primary key ("id"), constraint conjunto_par_ordem check (categoria_a < categoria_b));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_conjunto_par_deleted_at" ON "conjunto_par" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_conjunto_par_categoria_a_categoria_b_unique" ON "conjunto_par" ("categoria_a", "categoria_b") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "conjunto_regra" ("id" text not null, "nome" text not null, "escopo" text check ("escopo" in ('padrao', 'colecao', 'curado')) not null, "collection_id" text null, "tipo_desconto" text check ("tipo_desconto" in ('menor_peca_percentual', 'menor_peca_valor', 'total_percentual', 'total_valor')) not null, "valor" integer not null, "ativa" boolean not null default true, "promotion_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "conjunto_regra_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_conjunto_regra_deleted_at" ON "conjunto_regra" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_conjunto_regra_collection_id_unique" ON "conjunto_regra" ("collection_id") WHERE escopo = 'colecao' AND deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_conjunto_regra_escopo_unique" ON "conjunto_regra" ("escopo") WHERE escopo = 'padrao' AND deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "conjunto_curado" cascade;`);

    this.addSql(`drop table if exists "conjunto_par" cascade;`);

    this.addSql(`drop table if exists "conjunto_regra" cascade;`);
  }

}
