-- ============================================================
--  ATENCAO — LEIA ANTES DE RODAR
-- ============================================================
--  Este arquivo cria as tabelas. Ele NAO liga e NAO desliga a
--  protecao do banco (RLS).
--
--  Ate 22/08/2026 ele terminava com 17 linhas
--  `disable row level security`. Colar este arquivo no editor
--  DESFAZIA a protecao inteira em tres segundos — e o sistema
--  continuava funcionando igual, sem sinal nenhum de que a porta
--  tinha sido reaberta. As linhas foram removidas por isso.
--
--  A protecao esta LIGADA nas 17 tabelas desde 22/08/2026, com a
--  politica `equipe_ativa` (ver SQL-etapa1-C-TRANCA.sql).
--
--  Se voce criar uma TABELA NOVA, ela nasce sem protecao. Rode o
--  SQL-etapa1-C-TRANCA.sql depois, ou acrescente a tabela nova a
--  lista dele — senao ela fica aberta para a internet.
--
--  E no dialogo "Potential issue detected" do Supabase, escolha
--  "Run without RLS" e ligue depois pelo arquivo C. O botao verde
--  liga o RLS SEM politica, o que bloqueia o app inteiro.
-- ============================================================

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

-- KARDEX (etapa 2 do estoque): extrato de movimentação, com colunas de verdade.
-- A criação COMPLETA (índices, tranca RLS, a função registrar_movimentos que
-- grava movimento + saldo numa transação, e o trigger estoque_protege_saldo
-- que impede qualquer outra escrita de mexer no saldo) está em
-- SQL-etapa2-A-KARDEX.sql — rode aquele arquivo, não só esta linha.
create table if not exists estoque_mov (
  id          uuid primary key,
  seq         bigint generated always as identity,
  peca_id     text not null,
  qtd         numeric not null,
  tipo        text not null,
  motivo      text not null default '',
  origem_tipo text not null default '',
  origem_id   text not null default '',
  custo_unit  numeric,
  autor_id    text not null default '',
  autor_nome  text not null default '',
  criado_em   timestamptz not null default now()
);

-- Desabilitar RLS para desenvolvimento (habilitar com políticas antes do deploy)

-- Realtime: sem isto, uma tela nova não avisa as outras quando algo muda
alter publication supabase_realtime add table gastos;
alter publication supabase_realtime add table insumos;
