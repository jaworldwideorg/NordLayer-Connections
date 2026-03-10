import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const base = process.env.NODE_ENV === 'production' && repoName ? `/${repoName}/` : '/';

export default defineConfig({
  plugins: [react()],
  base,
});
