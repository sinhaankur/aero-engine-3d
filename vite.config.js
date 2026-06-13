import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base is set to the repo name so assets resolve under
// https://sinhaankur.github.io/AirbusEngine3D/
export default defineConfig({
  plugins: [react()],
  base: '/AirbusEngine3D/',
})
