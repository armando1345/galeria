import {authorizedFetch as fetch} from './access.mjs';
import {readFile} from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:8788';
const slots=(await readFile('private/accesos-estudiantes.csv','utf8')).trim().split('\n').slice(1).map(l=>l.trim().split(','));
const titles=['Órbita interior','Botánica eléctrica','Ciudad latente'];
for(let i=0;i<3;i++){const login=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({role:'student',code:slots[i][1]})});if(!login.ok)throw Error(await login.text());const cookie=login.headers.get('set-cookie').split(';')[0];const existing=await (await fetch(base+'/api/student',{headers:{cookie}})).json();if(existing.submissions.length&&!process.argv.includes('--replace')){console.log(`Espacio ${i+1}: ya tiene entrega; se conserva.`);continue;}
const f=new FormData(),n=String(i+1).padStart(2,'0');f.set('name',`Estudio Umbral · demo ${n}`);f.set('title',titles[i]);f.set('image',new Blob([await readFile(`public/demo/${n}.png`)],{type:'image/png'}),n+'.png');f.set('video',new Blob([await readFile(`demo/videos/${n}.mp4`)],{type:'video/mp4'}),n+'.mp4');const r=await fetch(base+'/api/submit',{method:'POST',headers:{Origin:base,cookie},body:f});if(!r.ok)throw Error(await r.text());console.log(`Espacio ${i+1}: entrega de demostración recibida.`);}
console.log('Aprueba las tres entregas, marca demo con el SQL de la guía y compila desde el panel.');

