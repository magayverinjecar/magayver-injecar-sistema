-- ============================================================
-- ETAPA 2 (ESTOQUE) — PASSO B: DESFAZER O KARDEX
-- ============================================================
-- Botão de pânico do passo A. Deixe aberto numa aba ANTES de
-- rodar o A, como na etapa 1.
--
-- ⚠️ ATENÇÃO: apagar a tabela estoque_mov APAGA O EXTRATO INTEIRO
-- de movimentação — todo o histórico registrado até aqui se perde
-- de vez. O saldo das peças NÃO é alterado (ele vive na tabela
-- estoque, que este arquivo não toca — só remove o trigger que
-- protegia o saldo, devolvendo a tabela ao comportamento antigo).
--
-- Só faz sentido rodar se a decisão for abandonar o kardex antes
-- de ele virar rotina. Com o app novo publicado e este arquivo
-- rodado, as baixas de estoque param de funcionar (ficam presas
-- na fila) — desfaça também a publicação do app.
-- ============================================================

drop trigger if exists estoque_protege_saldo on public.estoque;
drop function if exists public.estoque_protege_saldo();

drop function if exists public.registrar_movimentos(jsonb);

drop table if exists public.estoque_mov;

-- Confere: as três consultas devem voltar VAZIAS.
select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'estoque_mov';

select p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('registrar_movimentos', 'estoque_protege_saldo');

select tgname
  from pg_trigger
 where tgrelid = 'public.estoque'::regclass and tgname = 'estoque_protege_saldo';
