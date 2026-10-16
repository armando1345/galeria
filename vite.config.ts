import { defineConfig } from 'vite';
export default defineConfig({server:{proxy:{'/api':'http://127.0.0.1:8788'}},build:{target:'es2022',rollupOptions:{external:(id)=>id.startsWith('/vendor/'),input:{main:'index.html',scanner:'scanner.html',compiler:'compiler.html',publish:'publish.html'}}}});
