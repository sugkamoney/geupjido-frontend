/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NAVER_MAP_CLIENT_ID?: string;
  readonly VITE_MAP_PROVIDER?: 'naver' | 'fixture';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
