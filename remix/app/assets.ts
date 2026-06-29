import { createAssetServer } from 'remix/assets'

const rootDir = process.cwd()

export const assetServer = createAssetServer({
  basePath: '/assets',
  rootDir,
  fileMap: {
    'app/*path': 'app/*path',
    'node_modules/*path': 'node_modules/*path',
    '@packages/*path': '../packages/*path',
  },
  allow: ['app/assets/**', 'app/lib/**', 'app/data/**', 'app/components/chart/**', 'app/components/landing/**', 'app/types/**', 'app/constants/theme.ts', 'node_modules/**', '../packages/**'],
  deny: ['app/**/*.server.*'],
  sourceMaps: process.env.NODE_ENV === 'development' ? 'external' : undefined,
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
  },
})
