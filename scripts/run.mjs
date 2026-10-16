// Lanzador sin dependencia del PATH de npm/pnpm (usa los binarios ya instalados).
import {spawn} from 'node:child_process';
const [command,...args]=process.argv.slice(2);const bin={vite:'node_modules/vite/bin/vite.js',wrangler:'node_modules/wrangler/bin/wrangler.js',tsc:'node_modules/typescript/bin/tsc'}[command];if(!bin)throw Error('Usa vite, wrangler o tsc.');const p=spawn(process.execPath,[bin,...args],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:process.cwd()+'/.wrangler/logs/'}});p.on('exit',c=>process.exit(c??1));
