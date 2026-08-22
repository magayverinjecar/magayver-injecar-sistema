import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { carregando } = useApp()

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header onMenuClick={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Enquanto os dados nao chegaram, NENHUMA tela pode afirmar que esta
              vazia. Ate hoje so 8 das 20 telas avisavam que estavam carregando;
              as outras 12 — Ordens de Servico, Clientes, Estoque, Financeiro,
              Orcamentos... — simplesmente apareciam vazias, e quem olhava
              concluia que o sistema tinha perdido tudo.
              A janela ficou maior desde que os dados passaram a carregar SO
              depois do login (antes vinham antes, e ja estavam prontos quando a
              pessoa entrava). Uma guarda aqui cobre todas as telas de uma vez,
              sem tocar em cada uma. */}
          {carregando ? (
            <div className="flex flex-col items-center justify-center min-h-64 gap-3 text-slate-400">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
              <p className="text-sm">Carregando os dados da oficina…</p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}
