-- ============================================================
-- MAGAYVER INJECAR — Schema Supabase
-- Cole este SQL no Supabase → SQL Editor → New query → Run
-- ============================================================

-- Tabelas com id text e data jsonb
create table if not exists clientes        (id text primary key, data jsonb not null default '{}');
create table if not exists veiculos        (id text primary key, data jsonb not null default '{}');
create table if not exists funcionarios    (id text primary key, data jsonb not null default '{}');
create table if not exists ordens          (id text primary key, data jsonb not null default '{}');
create table if not exists estoque         (id text primary key, data jsonb not null default '{}');
create table if not exists financeiro      (id text primary key, data jsonb not null default '{}');
create table if not exists agenda          (id text primary key, data jsonb not null default '{}');
create table if not exists servicos        (id text primary key, data jsonb not null default '{}');
create table if not exists checklists      (id text primary key, data jsonb not null default '{}');
create table if not exists orcamentos      (id text primary key, data jsonb not null default '{}');
create table if not exists compras         (id text primary key, data jsonb not null default '{}');
create table if not exists fornecedores    (id text primary key, data jsonb not null default '{}');
create table if not exists caixa_turno     (id text primary key, data jsonb not null default '{}');
create table if not exists caixa_historico (id text primary key, data jsonb not null default '{}');
create table if not exists configuracoes   (id text primary key, data jsonb not null default '{}');
-- Gastos fixos e insumos moravam só no navegador (localStorage): cada aparelho
-- tinha a própria lista, limpar o navegador apagava tudo e não havia backup.
create table if not exists gastos          (id text primary key, data jsonb not null default '{}');
create table if not exists insumos         (id text primary key, data jsonb not null default '{}');

-- Desabilitar RLS para desenvolvimento (habilitar com políticas antes do deploy)
alter table clientes        disable row level security;
alter table veiculos        disable row level security;
alter table funcionarios    disable row level security;
alter table ordens          disable row level security;
alter table estoque         disable row level security;
alter table financeiro      disable row level security;
alter table agenda          disable row level security;
alter table servicos        disable row level security;
alter table checklists      disable row level security;
alter table orcamentos      disable row level security;
alter table compras         disable row level security;
alter table fornecedores    disable row level security;
alter table caixa_turno     disable row level security;
alter table caixa_historico disable row level security;
alter table configuracoes   disable row level security;
alter table gastos          disable row level security;
alter table insumos         disable row level security;

-- Realtime: sem isto, uma tela nova não avisa as outras quando algo muda
alter publication supabase_realtime add table gastos;
alter publication supabase_realtime add table insumos;
