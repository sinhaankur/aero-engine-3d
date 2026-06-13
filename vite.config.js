import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base is set to the repo name so assets resolve under
// https://sinhaankur.github.io/aircraft-engine-design/
export default defineConfig({
  plugins: [react()],
  base: '/aircraft-engine-design/',
})
