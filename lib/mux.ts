import Mux from '@mux/mux-node'

// Инициализируем SDK (токены берутся из .env.local)
export const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!
})

// Экспортируем раздел video
export const video = mux.video
