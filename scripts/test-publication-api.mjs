import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:8788';let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('✓',m)};
async function request(path,cookie='',body,extra={}){return fetch(base+'/api'+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{Origin:base}),...(body instanceof Uint8Array?{'Content-Type':'application/octet-stream','X-Upload-Size':String(body.length)}:body===undefined?{}:{'Content-Type':'application/json'}),...extra},...(body===undefined?{}:{body:body instanceof Uint8Array?body:JSON.stringify(body)})});}
async function start(){const r=await request('/creator/session','',{});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
const before=await(await request('/gallery')).json(),a=await start(),b=await start();
ok((await request('/creator/uploads','',{})).status===401,'La publicación requiere una sesión privada');
const da=await(await request('/creator/uploads',a,{})).json(),db=await(await request('/creator/uploads',b,{})).json();
ok((await request(`/creator/uploads/${da.id}/image`,b,Buffer.from('x'))).status===403,'Otra sesión no puede modificar la carga');
ok((await request(`/creator/uploads/${da.id}/image`,a,Buffer.from('x'),{'X-Upload-Size':String(12*1024*1024+1)})).status===413,'Imagen superior a 12 MiB se rechaza');
ok((await request(`/creator/uploads/${da.id}/video`,a,Buffer.from('x'),{'X-Upload-Size':String(100_000_001)})).status===413,'Video superior a 100 MB se rechaza');
ok((await request(`/creator/uploads/${da.id}/image`,a,Buffer.from('imagen falsa'))).status===400,'Se rechaza imagen falsa');
ok((await request(`/creator/uploads/${da.id}/video`,a,Buffer.from('video falso'))).status===400,'Se rechaza video falso después del streaming');
ok((await request(`/creator/uploads/${da.id}/publish`,a,Buffer.from('referencia falsa'))).status===400,'No se publica sin archivos válidos');
ok((await(await request('/gallery')).json()).id===before.id,'Los errores no modifican la galería');
const image=await readFile('tests/fixtures/publication.png'),video=await readFile('tests/fixtures/publication.mp4');
for(const[cookie,draft]of [[a,da],[b,db]]){assert.equal((await request(`/creator/uploads/${draft.id}/image`,cookie,image)).status,200);assert.equal((await request(`/creator/uploads/${draft.id}/video`,cookie,video)).status,200);}checks++;
ok((await request(`/creator/uploads/${da.id}/publish`,a,Buffer.from('referencia falsa'))).status===400,'La referencia se valida también después de cargar archivos');
const existing=JSON.parse(await readFile('output/autopublish/current.json','utf8'));const group=before.groups.find(g=>g.ids.includes(existing.id));assert.ok(group);const target=new Uint8Array(await(await fetch(base+group.target)).arrayBuffer());
const results=await Promise.all([request(`/creator/uploads/${da.id}/publish`,a,target),request(`/creator/uploads/${db.id}/publish`,b,target)]);
ok(results.every(r=>r.status===200),'Dos autores pueden publicar simultáneamente');
const after=await(await request('/gallery')).json();ok(after.works.some(w=>w.id===da.id)&&after.works.some(w=>w.id===db.id),'La publicación simultánea conserva ambas piezas');ok(before.works.every(w=>after.works.some(x=>x.id===w.id)),'Se conservan todas las piezas anteriores');
ok((await request(`/creator/uploads/${da.id}/publish`,a,target)).status===200,'Reintentar una publicación terminada es seguro');
ok((await request(`/creator/uploads/${da.id}/image`,a,image)).status===409,'Los archivos publicados son inmutables');
const replacement=await(await request('/creator/uploads',a,{})).json();
assert.equal((await request(`/creator/uploads/${replacement.id}/image`,a,image)).status,200);
assert.equal((await request(`/creator/uploads/${replacement.id}/video`,a,video)).status,200);
ok((await request(`/creator/uploads/${replacement.id}/publish`,a,target)).status===200,'El mismo creador puede publicar una versión nueva');
const replaced=await(await request('/gallery')).json(),old=after.works.find(w=>w.id===da.id),updated=replaced.works.find(w=>w.id===replacement.id);
ok(updated?.slot===old.slot&&!replaced.works.some(w=>w.id===da.id),'Reemplazar conserva el espacio y retira la versión anterior');
ok(after.works.filter(w=>w.id!==da.id).every(w=>replaced.works.some(x=>x.id===w.id)),'Reemplazar conserva las obras de los demás');
ok((await request(`/media/${da.id}/image`)).status===403,'La versión reemplazada deja de estar disponible para una solicitud pública nueva');
ok((await request(`/media/${da.id}/image`,a)).status===200,'El autor conserva acceso a su versión anterior');
const admin=(await readFile('private/organizador.txt','utf8')).trim().split('\n').at(-1).trim();
const login=await request('/login','',{role:'admin',code:admin});assert.equal(login.status,200);const adminCookie=login.headers.get('set-cookie').split(';')[0];
try{await request('/admin/closed',adminCookie,{closed:true});ok((await request('/creator/uploads',a,{})).status===409,'Cerrar publicaciones bloquea nuevas cargas');ok((await request(`/creator/uploads/${db.id}/publish`,b,target)).status===409,'Cerrar publicaciones se comprueba también en Publicar');}finally{await request('/admin/closed',adminCookie,{closed:false});}
ok((await(await request('/gallery')).json()).id===replaced.id,'El cierre y los intentos bloqueados conservan la publicación');
const ids=[da.id,db.id,replacement.id],slots=after.works.filter(w=>ids.includes(w.id)).map(w=>w.slot);
await writeFile('output/publication-api-tests.json',JSON.stringify({passed:true,checks,ids,slots,publication:after.id,date:new Date().toISOString()},null,2));console.log(`${checks} verificaciones de publicación completadas.`);
