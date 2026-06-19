import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { erro: null }
  }

  static getDerivedStateFromError(err) {
    return { erro: err }
  }

  componentDidCatch(err, info) {
    console.error('[ErrorBoundary] Erro capturado:', err, info)
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 max-w-lg w-full">
            <h2 className="text-lg font-bold text-red-600 mb-2">Erro na aplicação</h2>
            <p className="text-sm text-slate-600 mb-4">
              Ocorreu um erro inesperado. Abra o Console do navegador (F12) para mais detalhes.
            </p>
            <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-3 overflow-auto max-h-40 text-red-500 mb-4">
              {this.state.erro?.message}
            </pre>
            <button
              onClick={() => { this.setState({ erro: null }); window.location.reload() }}
              className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Recarregar página
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
