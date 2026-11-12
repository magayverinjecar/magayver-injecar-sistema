import LucroPorOSConteudo from '../components/LucroPorOSConteudo'

// A tela "Lucro por OS" sozinha — é a que o botão "Abrir numa aba nova" do
// Financeiro abre, e a do menu lateral. Só para quem tem 'lucro-por-os'
// (a trava fica na rota, em App.jsx). O título vem do cabeçalho do sistema.
export default function LucroPorOS() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">As OS fechadas, quanto cada uma deixou e quanto é do fornecedor.</p>
      <LucroPorOSConteudo />
    </div>
  )
}
