import {authorizedFetch as fetch} from './access.mjs';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:8788';
const codes=(await readFile('private/accesos-estudiantes.csv','utf8')).trim().split('\n').slice(1).map(x=>x.trim().split(',')[1]);const admin=(await readFile('private/organizador.txt','utf8')).trim().split('\n').at(-1).trim();let checks=0;const ok=(condition,message)=>{assert.ok(condition,message);checks++;console.log('✓',message);};
async function login(code,role='student'){const r=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({code,role})});assert.equal(r.status,200,await r.clone().text());return r.headers.get('set-cookie').split(';')[0];}
async function request(path,cookie='',data,method=data===undefined?'GET':'POST'){return fetch(base+'/api'+path,{method,headers:{...(cookie?{cookie}:{}),...(method!=='GET'?{Origin:base}:{}),...(data instanceof FormData?{}:data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:data instanceof FormData?data:JSON.stringify(data)})});}
const before=await(await request('/gallery')).json();ok(before.works.length>=3,'Hay tres obras públicas con referencias reales');
ok((await request('/admin')).status===401,'Panel privado sin sesión');ok((await request('/submit','',{})).status===401,'No hay cargas anónimas');
const a=await login(codes[20]),b=await login(codes[21]),adm=await login(admin,'admin');
ok((await request('/admin',a)).status===403,'Un estudiante no accede a administración');
const csrf=await fetch(base+'/api/admin/closed',{method:'POST',headers:{cookie:adm,Origin:'https://ajeno.example','Content-Type':'application/json'},body:JSON.stringify({closed:true})});ok(csrf.status===403,'Se bloquean escrituras desde otro origen');
const form=async(title='Prueba automatizada privada')=>{const f=new FormData();f.set('name','Prueba de integración');f.set('title',title);f.set('image',new Blob([await readFile('public/demo/01.png')],{type:'image/png'}),'01.png');f.set('video',new Blob([await readFile('demo/videos/01.mp4')],{type:'video/mp4'}),'01.mp4');return f;};
let f=await form();f.set('video',new Blob(['no es un MP4'],{type:'video/mp4'}),'falso.mp4');ok((await request('/submit',a,f)).status===400,'El servidor rechaza MP4 falso');
const r=await request('/submit',a,await form());ok(r.status===201,'Entrega válida almacenada en D1 y R2');const{id}=await r.json();
const own=await(await request('/student',a)).json();ok(own.slot===21&&own.submissions.some(s=>s.id===id),'La entrega queda asociada al espacio autenticado');
ok((await request(`/media/${id}/image`,a)).status===200,'El estudiante puede previsualizar su archivo privado');
ok((await request(`/media/${id}/image`,b)).status===403,'Otro estudiante no puede leer su imagen');ok((await request(`/media/${id}/video`)).status===403,'El video pendiente no es público');
ok((await request(`/admin/works/${id}`,a,{status:'approved'})).status===403,'Un estudiante no se puede aprobar');
const row=own.submissions.find(s=>s.id===id);ok((await request('/admin/works/'+id,adm,{...row,status:'approved',active:true})).status===200,'Organizador aprueba una entrega');
const still=await(await request('/gallery')).json();ok(still.id===before.id&&!still.works.some(w=>w.id===id),'La aprobación no cambia la galería publicada');
const prepared=await(await request('/admin/prepare',adm)).json();ok(prepared.works.some(w=>w.id===id),'La siguiente compilación incluye la nueva aprobación');
ok((await request('/submit',a,await form('Nueva revisión privada'))).status===201,'Estudiante puede reemplazar su entrega');ok((await(await request('/gallery')).json()).id===before.id,'Reemplazar tampoco modifica la publicación');
await request('/admin/closed',adm,{closed:true});ok((await request('/submit',a,await form())).status===409,'El cierre impide nuevas entregas en servidor');await request('/admin/closed',adm,{closed:false});
await request('/admin/works/'+id,adm,{...row,status:'rejected',active:false,feedback:'Prueba automatizada completada; no publicar.'});
const range=await fetch(base+before.works[0].video,{headers:{Range:'bytes=0-99'}});ok(range.status===206&&(await range.arrayBuffer()).byteLength===100,'Videos públicos admiten carga parcial por rangos');
const target=await fetch(base+before.groups[0].target);ok(target.status===200&&(await target.arrayBuffer()).byteLength>1000,'Archivo .mind publicado disponible');
const bad=new FormData();bad.set('digest','incorrecto');bad.set('groups','[]');ok((await request('/admin/publish',adm,bad)).status===409,'Una publicación con referencias obsoletas se rechaza');
await request('/logout',a,{});ok((await request('/student',a)).status===401,'Cerrar sesión invalida el acceso en servidor');
await mkdir('output',{recursive:true});await writeFile('output/api-tests.json',JSON.stringify({checks,date:new Date().toISOString(),passed:true},null,2));console.log(`${checks} verificaciones de integración completadas.`);

