import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the PNG icons in public/ from public/icon.svg. Run with `npm run icons`.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#34c759' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#34c759' } },
  },
  images: ['public/icon.svg'],
})
