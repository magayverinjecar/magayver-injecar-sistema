-- ============================================================================
-- CORRIGIR: foto de vistoria não sobe desde que o login por pessoa entrou no ar
-- ============================================================================
--
-- O SINTOMA
-- "Erro ao enviar imagem. Verifique a conexão e tente de novo." ao tirar foto
-- de vistoria. A conexão está boa; a mensagem é que chuta o motivo.
--
-- A CAUSA — medida em 24/08/2026, não deduzida:
--
--   upload anônimo (sem login) ....... 200 OK
--   upload autenticado (logado) ...... 403 "new row violates row-level
--                                          security policy"
--
-- O bucket "Fotos" tem política de INSERT para o papel `anon` e NENHUMA para
-- `authenticated`. Enquanto o sistema não tinha login de verdade, todo mundo
-- era `anon` e subia foto. Em 22/08 o login por e-mail e senha entrou em
-- produção: todo usuário passou a ser `authenticated`, e a política deixou de
-- valer para ele. As 17 tabelas foram tratadas naquele trabalho; o Storage
-- ficou de fora — nenhum SQL deste projeto jamais tocou em storage.objects.
--
-- O QUE CONTINUA FUNCIONANDO E NÃO PODE QUEBRAR
--   • Leitura pública das fotos (testada: 200 image/jpeg sem chave nenhuma).
--   • /assinar/:id — o cliente assina SEM login, como `anon`, gravando em
--     fotos/assinaturas/. Por isso a política anônima não é simplesmente
--     apagada aqui.
--   • /vistoria/:id — o cliente digita o telefone e vê as fotos do carro dele.
--     O telefone é conferido pela função `os_do_cliente` no banco, e as fotos
--     abrem pela URL pública. Essa tela SÓ LÊ: não sobe nada. A PARTE 1 abaixo
--     apenas ACRESCENTA permissão para quem tem login, então não toca nela.
--
-- UMA COISA QUE VALE SABER (não é urgênte, não muda nada aqui): o bucket é
-- público para leitura, então a trava do telefone protege a LISTA de fotos de
-- cada OS, e não o arquivo em si — quem receber o link direto de uma foto
-- consegue abrir. Sempre foi assim; só está escrito agora.
--
-- COMO RODAR
-- Supabase → SQL Editor → cole a PARTE 1 → Run. É só adição de política:
-- não remove nem altera nada que já existe. Depois teste tirar uma foto.
-- ============================================================================


-- ============================================================================
-- PARTE 1 — A CORREÇÃO  [JÁ RODADA EM 24/08/2026 — upload logado voltou a 200]
-- ============================================================================

-- INSERT: é esta a que estava faltando e derrubava a vistoria.
drop policy if exists "fotos_authenticated_insert" on storage.objects;
create policy "fotos_authenticated_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'Fotos');

-- UPDATE: o app sobe com upsert:true, que vira UPDATE quando o arquivo já
-- existe. Sem esta, refazer uma foto no mesmo caminho falharia igual.
drop policy if exists "fotos_authenticated_update" on storage.objects;
create policy "fotos_authenticated_update"
on storage.objects for update to authenticated
using (bucket_id = 'Fotos')
with check (bucket_id = 'Fotos');

-- SELECT: a leitura pelo app hoje passa pela URL pública, mas listar arquivo
-- pelo cliente autenticado (limpeza, conferência) precisa desta.
drop policy if exists "fotos_authenticated_select" on storage.objects;
create policy "fotos_authenticated_select"
on storage.objects for select to authenticated
using (bucket_id = 'Fotos');

-- DELETE: hoje NINGUÉM consegue apagar arquivo (testado: 403 tanto anônimo
-- quanto logado). Remover a foto na tela só tira do registro da OS; o arquivo
-- fica no bucket para sempre. Isto abre a porta para a faxina futura.
drop policy if exists "fotos_authenticated_delete" on storage.objects;
create policy "fotos_authenticated_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'Fotos');


-- ============================================================================
-- CONFERÊNCIA — rode junto e leia o resultado
-- ============================================================================
-- Devem aparecer as quatro linhas novas com roles = {authenticated}, mais as
-- políticas que já existiam. Se alguma anônima aparecer com cmd = INSERT e
-- qualificador amplo, veja a PARTE 2.
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;


-- ============================================================================
-- PARTE 2 — FECHAR O BURACO (rode depois de confirmar que a foto voltou)
-- ============================================================================
--
-- PARTE 1 RODADA EM 24/08/2026 — confirmado: upload logado voltou a 200, e as
-- políticas existentes são estas seis:
--
--   Allow anon read              SELECT  {anon}           bucket_id = 'Fotos'
--   Allow anon upload            INSERT  {anon}           bucket_id = 'Fotos'   <-- o buraco
--   fotos_authenticated_insert   INSERT  {authenticated}
--   fotos_authenticated_update   UPDATE  {authenticated}
--   fotos_authenticated_select   SELECT  {authenticated}
--   fotos_authenticated_delete   DELETE  {authenticated}
--
-- O BURACO: "Allow anon upload" deixa QUALQUER UM subir arquivo no bucket, em
-- qualquer caminho, sem login. A chave anônima vai dentro do JavaScript
-- publicado — quem abre o site tem ela. Dá para encher o bucket de lixo.
--
-- POR QUE NÃO SE APAGA E PRONTO: o cliente assinando a OS pelo celular dele, em
-- /assinar/:id, NÃO TEM LOGIN. Ele é `anon`, e precisa gravar a rubrica. Esse
-- upload vai SEMPRE para fotos/assinaturas/. Então a correção é ESTREITAR o
-- que o anônimo pode fazer, e não tirar.
--
-- "Allow anon read" FICA como está: o bucket é público para leitura de qualquer
-- jeito, e é por ela que o cliente vê as fotos do carro em /vistoria/:id.

drop policy if exists "Allow anon upload" on storage.objects;

create policy "fotos_anon_so_assinatura"
on storage.objects for insert to anon
with check (bucket_id = 'Fotos' and name like 'fotos/assinaturas/%');


-- DEPOIS DE RODAR A PARTE 2, TESTE A ASSINATURA DE VERDADE:
-- abra o link /assinar/ de uma OS no celular e assine. Tem que gravar igual.
--
-- (Se falhar, a tela cai para gravar a assinatura embutida na OS — não se perde
-- nada. Mas volta a inchar a tabela, que foi problema já resolvido antes. Nesse
-- caso rode o DESFAZER DA PARTE 2 logo abaixo e me avise.)
--
-- DESFAZER A PARTE 2:
--   drop policy if exists "fotos_anon_so_assinatura" on storage.objects;
--   create policy "Allow anon upload"
--   on storage.objects for insert to anon
--   with check (bucket_id = 'Fotos');


-- ============================================================================
-- DESFAZER — se algo sair errado, isto volta ao estado de antes
-- ============================================================================
-- drop policy if exists "fotos_authenticated_insert" on storage.objects;
-- drop policy if exists "fotos_authenticated_update" on storage.objects;
-- drop policy if exists "fotos_authenticated_select" on storage.objects;
-- drop policy if exists "fotos_authenticated_delete" on storage.objects;
