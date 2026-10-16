import {mkdir,writeFile,readFile,copyFile,access} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sha=s=>createHash('sha256').update(s).digest('hex');
await mkdir('private',{recursive:true});await mkdir('public/vendor/addons/renderers',{recursive:true});
if(!process.argv.includes('--assets-only'))try{await access('.dev.vars');console.log('Los accesos ya existen. No se reemplazaron.');}catch{
const admin=randomBytes(24).toString('base64url');const slots=Array.from({length:40},(_,i)=>({id:i+1,code:randomBytes(24).toString('base64url')}));
await writeFile('.dev.vars',`ADMIN_CODE_SHA256="${sha(admin)}"\n`);
await writeFile('private/organizador.txt',`Código privado de organizador (solo local; cambia el secreto para producción):\n${admin}\n`);
await writeFile('private/accesos-estudiantes.csv','espacio,codigo\n'+slots.map(s=>`${s.id},${s.code}`).join('\n')+'\n');
await writeFile('private/seed.sql',slots.map(s=>`INSERT INTO slots(id,token_hash) VALUES (${s.id},'${sha(s.code)}') ON CONFLICT(id) DO UPDATE SET token_hash=excluded.token_hash WHERE slots.token_hash LIKE 'auto:%';`).join('\n'));
console.log('Creados 40 códigos privados iniciales y el acceso del organizador en private/. No los subas a GitHub.');}
for(const file of ['mindar-image-three.prod.js','mindar-image.prod.js','controller-mGt1s8dJ.js','ui-fBadYuor.js']){try{await access('public/vendor/'+file);}catch{throw Error('Falta vendor MindAR. Consulta README.md para restaurarlo.');}}
await copyFile('node_modules/three/build/three.module.js','public/vendor/three.module.js');
await copyFile('node_modules/three/examples/jsm/renderers/CSS3DRenderer.js','public/vendor/addons/renderers/CSS3DRenderer.js');
// Resolve the upstream bare module specifiers locally; no inline import map/CDN.
for(const file of ['public/vendor/mindar-image-three.prod.js','public/vendor/addons/renderers/CSS3DRenderer.js']){
 const source=await readFile(file,'utf8');const local=file.includes('addons/')?'../../three.module.js':'./three.module.js';
 await writeFile(file,source.replace(/from ["']three["']/g,`from '${local}'`).replace(/from ["']three\/addons\/renderers\/CSS3DRenderer.js["']/g,"from './addons/renderers/CSS3DRenderer.js'"));
}
console.log('Bibliotecas del navegador preparadas. Ejecuta pnpm db:local y aplica private/seed.sql.');
