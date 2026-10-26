import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>({plugins:[react()],define:{__PLANE__:JSON.stringify(mode==='control'?'control':'runtime')},build:{outDir:mode==='control'?'dist-control':'dist-runtime'},server:{proxy:{'/api':mode==='control'?'http://127.0.0.1:3002':'http://127.0.0.1:3001','/socket.io':{target:'http://127.0.0.1:3001',ws:true}}}}));
