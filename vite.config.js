import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Carimbo do momento em que o pacote foi gerado.
//
// O rodape dizia "v1.0.0" desde sempre, entao nao havia como saber, olhando a
// tela, qual versao um aparelho esta rodando. Custou caro: cinco correcoes
// ficaram bloqueadas na publicacao por cinco dias e ninguem percebeu, porque a
// tela parecia a mesma. Agora a data esta na tela.
const CARIMBO = new Date().toLocaleString('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit', month: '2-digit', year: '2-digit',
  hour: '2-digit', minute: '2-digit',
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: { __VERSAO_BUILD__: JSON.stringify(CARIMBO) },
})
