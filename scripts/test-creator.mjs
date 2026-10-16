import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:8788';let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;console.log('✓',label);};
async function req(path,cookie='',body,origin=base){return fetch(base+'/api'+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{Origin:origin}),...(body===undefined||body instanceof FormData?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})});}
async function start(){const r=await req('/creator/session','',{});ok(r.status===200,'Se inicia creación sin pedir un código');const cookie=r.headers.get('set-cookie');ok(cookie.includes('HttpOnly')&&cookie.includes('SameSite=Strict'),'Sesión privada con cookie protegida');const data=await r.json();ok(data.slot===null&&!data.submission,'Abrir el formulario no ocupa un espacio');return cookie.split(';')[0];}
async function form(){const f=new FormData();f.set('image',new Blob([await readFile('public/demo/01.png')],{type:'image/png'}),'inicio.png');f.set('video',new Blob([await readFile('demo/videos/01.mp4')],{type:'video/mp4'}),'video.mp4');return f;}
const admin=(await readFile('private/organizador.txt','utf8')).trim().split('\n').at(-1).trim();
const login=await req('/login','',{role:'admin',code:admin});assert.equal(login.status,200);const adminCookie=login.headers.get('set-cookie').split(';')[0];
const initial=await(await req('/gallery')).json();
ok((await req('/creator/submit','',await form())).status===401,'No se aceptan archivos sin una sesión de creación');
ok((await req('/creator/session','',{},'https://ajeno.example')).status===403,'No se pueden crear sesiones desde otro origen');
const a=await start(),b=await start();
const malformed=await form();malformed.set('video',new Blob(['falso'],{type:'video/mp4'}),'falso.mp4');ok((await req('/creator/submit',a,malformed)).status===400,'La carga sin código mantiene la validación de video');
const results=await Promise.all([req('/creator/submit',a,await form()),req('/creator/submit',b,await form())]);
ok(results.every(r=>r.status===201),'Dos confirmaciones simultáneas guardan sus archivos');
const [one,two]=await Promise.all(results.map(r=>r.json()));ok(one.slot!==two.slot,'Las confirmaciones simultáneas obtienen espacios distintos');
ok((await req(`/media/${one.id}/image`,a)).status===200,'El creador puede ver su propia imagen privada');
ok((await req(`/media/${one.id}/image`,b)).status===403,'Otra sesión no puede ver esa imagen');
ok((await req(`/media/${one.id}/video`)).status===403,'La entrega nueva no es pública');
ok([401,403].includes((await req('/admin',a)).status),'La sesión automática no accede a administración');
const stored=await(await req('/creator/session',a,{})).json();ok(stored.slot===one.slot&&stored.submission.id===one.id,'Recargar recupera la entrega del mismo navegador');
ok(stored.submission.title===`Obra ${String(one.slot).padStart(2,'0')}`,'Nombre y título se asignan sin campos adicionales');
const replacement=await req('/creator/submit',a,await form());ok(replacement.status===201&&(await replacement.json()).slot===one.slot,'Reemplazar conserva el mismo espacio');
ok((await(await req('/gallery')).json()).id===initial.id,'Las entregas nuevas conservan la galería publicada');
try{await req('/admin/closed',adminCookie,{closed:true});ok((await req('/creator/submit',a,await form())).status===409,'El cierre del organizador también protege la carga sin códigos');}finally{await req('/admin/closed',adminCookie,{closed:false});}
const combined=await req('/creator/session',adminCookie,{});ok(combined.headers.get('set-cookie').startsWith('umbral_creator='),'Crear no reemplaza la sesión del organizador');ok((await req('/admin',adminCookie)).status===200,'El organizador conserva su acceso');
await writeFile('output/creator-tests.json',JSON.stringify({passed:true,checks,slots:[one.slot,two.slot],date:new Date().toISOString()},null,2));console.log(`${checks} verificaciones de creación sin códigos completadas.`);
