import {hasAccess,unlock,accessStatus} from './access';
import {deletePair} from './collection';
import {creatorPublication} from './creator-publication';
import {reserveSpace} from './spaces';
import { decode } from '@msgpack/msgpack';
import {ensure,HttpError,imageInfo,videoInfo} from './media';
export interface Env {DB:D1Database;MEDIA:R2Bucket;ADMIN_CODE_SHA256:string;ACCESS_PIN_SHA256:string}
type Submission={id:string;slot_id:number;name:string;title:string;image_key:string;video_key:string;width:number;height:number;duration:number;status:string;active:number;feedback:string;demo:number;created_at:string};
type Session={role:string;slot_id:number|null};
export const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const json=(v:unknown,status=200,headers:HeadersInit={})=>Response.json(v,{status,headers:{'Cache-Control':'no-store',...headers}});
async function setting(env:Env,key:string){return (await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{value:string}>())?.value;}
function cookieToken(req:Request,name='umbral'){return req.headers.get('Cookie')?.match(new RegExp('(?:^|; )'+name+'=([a-f0-9]{64})'))?.[1];}
async function session(req:Request,env:Env,name='umbral'):Promise<Session|null>{const token=cookieToken(req,name);if(!token)return null;return env.DB.prepare('SELECT role,slot_id FROM sessions WHERE hash=? AND expires>?').bind(await hash(token),Date.now()).first<Session>();}
async function creatorData(env:Env,person:Session){const submission=person.slot_id===null?null:await env.DB.prepare('SELECT * FROM submissions WHERE slot_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').bind(person.slot_id).first<Submission>();const gallery=await publicManifest(env);return {slot:person.slot_id,submission,published:!!submission&&gallery.works.some((w:{id:string})=>w.id===submission.id),closed:(await setting(env,'closed'))==='true'};}
async function candidates(env:Env){const {results}=await env.DB.prepare("SELECT * FROM submissions WHERE status='approved' AND active=1 ORDER BY slot_id, created_at DESC, rowid DESC").all<Submission>();return results.filter((s,i,a)=>a.findIndex(x=>x.slot_id===s.slot_id)===i);}
function publicWork(s:Submission,index:number){return {id:s.id,slot:s.slot_id,name:s.name,title:s.title,width:s.width,height:s.height,demo:!!s.demo,index,image:`/api/media/${s.id}/image`,video:`/api/media/${s.id}/video`};}
async function publicManifest(env:Env){const row=await env.DB.prepare('SELECT manifest FROM publications ORDER BY rowid DESC LIMIT 1').first<{manifest:string}>();return row?JSON.parse(row.manifest):{id:null,groups:[],works:[]};}
async function digest(rows:Submission[]){return hash(JSON.stringify(rows));}
function textField(v:unknown,max:number){ensure(typeof v==='string'&&v.trim().length>0&&v.trim().length<=max,`Texto obligatorio, máximo ${max} caracteres.`);return v.trim();}
export async function handle(req:Request,env:Env):Promise<Response>{
 try {
 const url=new URL(req.url),path=url.pathname.replace(/^\/api/,'');
 if(req.method!=='GET'&&req.method!=='HEAD') {ensure(req.headers.get('Origin')===url.origin,'Origen de solicitud no permitido.',403);const bodyLimit=/^\/creator\/uploads\/[a-f0-9-]{36}\/video$/.test(path)?100_000_000:64*1024*1024;ensure(Number(req.headers.get('Content-Length')||0)<=bodyLimit,'La carga supera el tamaño permitido.',413);}
 if(path==='/access/session'&&req.method==='GET')return await accessStatus(req,env);
 if(path==='/access'&&req.method==='POST')return await unlock(req,env);
 if(path==='/scan'&&req.method==='GET'){const gallery=await publicManifest(env);return json({id:gallery.id,groups:gallery.groups,works:gallery.works.map((w:{id:string;width:number;height:number;video:string})=>({id:w.id,width:w.width,height:w.height,video:w.video}))});}
 const needsAccess=path==='/gallery'||path.startsWith('/creator/')||path.startsWith('/collection/')||path.startsWith('/admin')||path==='/submit'||path==='/student'||/^\/media\/[^/]+\/image$/.test(path);
 if(needsAccess)ensure(await hasAccess(req,env),'Ingresa el PIN de acceso',401);
 if(path==='/gallery'&&req.method==='GET')return json(await publicManifest(env));
 let who=await session(req,env);
 const creator=path.startsWith('/creator/')||path.startsWith('/media/')||path.startsWith('/collection/')?await session(req,env,'umbral_creator'):null;
 if(path.startsWith('/creator/uploads')){ensure(creator?.role==='creator','Abre Crea tu obra para publicar.',401);return await creatorPublication(req,env,await hash(cookieToken(req,'umbral_creator')!));}
 const deletion=path.match(/^\/collection\/works\/([a-zA-Z0-9_-]{1,100})\/delete$/);
 if(deletion&&req.method==='POST'){ensure(creator?.role==='creator'||who?.role==='admin','Abre la colección para continuar.',401);return await deletePair(env,deletion[1]);}
 if((path==='/creator/session'||path==='/creator/new')&&req.method==='POST'){
   if(path==='/creator/session'&&creator?.role==='creator')return json(await creatorData(env,creator));
   const key=await hash('creator:'+(req.headers.get('CF-Connecting-IP')||'local'));const attempt=await env.DB.prepare('SELECT count,reset FROM attempts WHERE key=?').bind(key).first<{count:number;reset:number}>();
   ensure(!attempt||attempt.reset<Date.now()||attempt.count<40,'Demasiadas sesiones nuevas. Vuelve a intentarlo más tarde.',429);
   await env.DB.prepare('INSERT INTO attempts(key,count,reset) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset<? THEN 1 ELSE count+1 END,reset=CASE WHEN reset<? THEN excluded.reset ELSE reset END').bind(key,Date.now()+3600000,Date.now(),Date.now()).run();
   const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
   await env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()).run();
   await env.DB.prepare("INSERT INTO sessions(hash,role,slot_id,expires) VALUES (?,'creator',NULL,?)").bind(await hash(token),Date.now()+90*86400000).run();
   return json(await creatorData(env,{role:'creator',slot_id:null}),200,{'Set-Cookie':`umbral_creator=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=7776000${url.protocol==='https:'?'; Secure':''}`});
 }
 if(path==='/session'&&req.method==='GET')return json({session:who,closed:(await setting(env,'closed'))==='true'});
 if(path==='/login'&&req.method==='POST'){
   const ip=req.headers.get('CF-Connecting-IP')||'local';const key=await hash(ip);const attempt=await env.DB.prepare('SELECT count,reset FROM attempts WHERE key=?').bind(key).first<{count:number;reset:number}>();ensure(!attempt||attempt.reset<Date.now()||attempt.count<12,'Demasiados intentos. Espera 15 minutos.',429);
   await env.DB.prepare('INSERT INTO attempts(key,count,reset) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset<? THEN 1 ELSE count+1 END,reset=CASE WHEN reset<? THEN excluded.reset ELSE reset END').bind(key,Date.now()+900000,Date.now(),Date.now()).run();
   const {code,role}=await req.json() as {code:string;role:string};ensure(typeof code==='string'&&code.length<=200,'Código inválido.',401);const h=await hash(code.trim());let slot:number|null=null;
   if(role==='admin')ensure(env.ADMIN_CODE_SHA256&&h===env.ADMIN_CODE_SHA256,'Código inválido.',401);
   else {const row=await env.DB.prepare('SELECT id FROM slots WHERE token_hash=?').bind(h).first<{id:number}>();ensure(row,'Código inválido.',401);slot=row.id;}
   await env.DB.prepare('DELETE FROM attempts WHERE key=?').bind(key).run();
   const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');await env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()).run();await env.DB.prepare('INSERT INTO sessions VALUES (?,?,?,?)').bind(await hash(token),role==='admin'?'admin':'student',slot,Date.now()+8*3600000).run();
   return json({ok:true},200,{'Set-Cookie':`umbral=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=28800${url.protocol==='https:'?'; Secure':''}`});
 }
 if(path==='/logout'&&req.method==='POST') {const t=req.headers.get('Cookie')?.match(/umbral=([a-f0-9]{64})/)?.[1];if(t)await env.DB.prepare('DELETE FROM sessions WHERE hash=?').bind(await hash(t)).run();return json({ok:true},200,{'Set-Cookie':'umbral=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0'});}
 if(path.startsWith('/media/')&&req.method==='GET'){
   const [, ,id,kind]=path.split('/');ensure(kind==='image'||kind==='video','Recurso inválido.',404);const s=await env.DB.prepare('SELECT * FROM submissions WHERE id=?').bind(id).first<Submission>();ensure(s,'No encontrado.',404);const manifest=await publicManifest(env);const pub=manifest.works.some((x:{id:string})=>x.id===id);if(!pub)ensure(await hasAccess(req,env),'Ingresa el PIN de acceso',401);ensure(pub||who?.role==='admin'||who?.slot_id===s.slot_id||creator?.slot_id===s.slot_id,'Acceso privado.',403);
   const object=await env.MEDIA.get(kind==='image'?s.image_key:s.video_key,{range:req.headers});ensure(object,'Archivo no encontrado.',404);const headers=new Headers();object.writeHttpMetadata(headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Cache-Control',pub&&kind==='video'?'public, max-age=3600, immutable':'private, no-store');headers.set('Accept-Ranges','bytes');headers.set('ETag',object.httpEtag);if(req.headers.has('Range') && object.range && 'offset' in object.range && object.range.offset!==undefined && object.range.length!==undefined){headers.set('Content-Range',`bytes ${object.range.offset}-${object.range.offset+object.range.length-1}/${object.size}`);headers.set('Content-Length',String(object.range.length));return new Response(object.body,{status:206,headers});}return new Response(object.body,{headers});
 }
 if(path.startsWith('/targets/')&&req.method==='GET'){const manifest=await publicManifest(env);const group=manifest.groups.find((g:{target:string})=>g.target===url.pathname);ensure(group,'Referencia no publicada.',404);const obj=await env.MEDIA.get(url.pathname.replace('/api/',''));ensure(obj,'Referencia no encontrada.',404);return new Response(obj.body,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'public, max-age=31536000, immutable'}});}
 if(path==='/creator/submit')who=creator;
 ensure(who,'Inicia sesión para continuar.',401);
 if(path==='/student'&&req.method==='GET'){ensure(who.role==='student','Acceso de estudiante requerido.',403);const {results}=await env.DB.prepare('SELECT * FROM submissions WHERE slot_id=? ORDER BY created_at DESC,rowid DESC LIMIT 10').bind(who.slot_id).all();return json({slot:who.slot_id,submissions:results,closed:(await setting(env,'closed'))==='true'});}
 if((path==='/submit'||path==='/creator/submit')&&req.method==='POST'){
   const automatic=path==='/creator/submit';
   ensure(who.role===(automatic?'creator':'student'),'Acceso de creación requerido.',403);
   ensure((await setting(env,'closed'))!=='true','Las entregas están cerradas.',409);
   const form=await req.formData();
   let name=automatic?'':textField(form.get('name'),80),title=automatic?'':textField(form.get('title'),120);
   const image:unknown=form.get('image'),video:unknown=form.get('video');
   ensure(image instanceof File&&video instanceof File,'Selecciona la imagen inicial y el video.');
   ensure(image.size<=12*1024*1024&&video.size<=50*1024*1024,'Máximos: imagen 12 MB; video 50 MB.');
   const ib=new Uint8Array(await image.arrayBuffer()),vb=new Uint8Array(await video.arrayBuffer());
   const im=imageInfo(ib),vi=videoInfo(vb);
   let claimHash:string|null=null;
   if(automatic&&who.slot_id===null){
     claimHash=await hash(cookieToken(req,'umbral_creator')!);
     // One SQLite statement claims a free space; concurrent browsers cannot share it.
     await reserveSpace(env,claimHash);
     who=await session(req,env,'umbral_creator');
     ensure(who&&who.slot_id!==null,'No se pudo asignar un espacio. Vuelve a intentarlo.',409);
   }
   ensure(who.slot_id!==null,'No se pudo asignar un espacio.',409);
   const slot=who.slot_id;
   if(automatic){const previous=await env.DB.prepare('SELECT name,title FROM submissions WHERE slot_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').bind(slot).first<{name:string;title:string}>();name=previous?.name||`Participante ${String(slot).padStart(2,'0')}`;title=previous?.title||`Obra ${String(slot).padStart(2,'0')}`;}
   const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM submissions WHERE slot_id=? AND created_at>datetime('now','-1 day')").bind(slot).first<{n:number}>();
   ensure((count?.n||0)<12,'Máximo 12 revisiones por día.',429);
   const id=crypto.randomUUID(),ik=`private/${id}/image`,vk=`private/${id}/video`;
   try{
     await env.MEDIA.put(ik,ib,{httpMetadata:{contentType:im.mime}});
     await env.MEDIA.put(vk,vb,{httpMetadata:{contentType:'video/mp4'}});
     const result=await env.DB.prepare("INSERT INTO submissions(id,slot_id,name,title,image_key,video_key,width,height,duration) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT value FROM settings WHERE key='closed')='false'").bind(id,slot,name,title,ik,vk,im.width,im.height,vi.duration).run();
     ensure(result.meta.changes===1,'Las entregas se cerraron durante la carga.',409);
   }catch(e){
     await env.MEDIA.delete([ik,vk]);
     if(claimHash)await env.DB.prepare('UPDATE sessions SET slot_id=NULL WHERE hash=? AND NOT EXISTS(SELECT 1 FROM submissions WHERE slot_id=?)').bind(claimHash,slot).run();
     throw e;
   }
   return json({ok:true,id,slot},201);
 }
 ensure(who.role==='admin','Acceso de organizador requerido.',403);
 if(path==='/admin'&&req.method==='GET'){const [slots,submissions]=await Promise.all([env.DB.prepare('SELECT id FROM slots ORDER BY id').all(),env.DB.prepare('SELECT * FROM submissions ORDER BY created_at DESC,rowid DESC').all()]);return json({slots:slots.results,submissions:submissions.results,closed:(await setting(env,'closed'))==='true',publication:await publicManifest(env)});}
 if(path==='/admin/closed'&&req.method==='POST'){const {closed}=await req.json() as {closed:boolean};ensure(typeof closed==='boolean','Valor inválido.');await env.DB.prepare("UPDATE settings SET value=? WHERE key='closed'").bind(String(closed)).run();return json({ok:true});}
 if(path.match(/^\/admin\/works\//)&&req.method==='POST'){const id=path.split('/').pop()!;const data=await req.json() as Record<string,unknown>;ensure(['pending','approved','rejected'].includes(String(data.status)),'Estado inválido.');const name=textField(data.name,80),title=textField(data.title,120);ensure(typeof data.feedback==='string'&&data.feedback.length<=500,'Comentario demasiado largo.');await env.DB.prepare('UPDATE submissions SET name=?,title=?,status=?,active=?,feedback=? WHERE id=?').bind(name,title,data.status,data.active?1:0,data.feedback,id).run();return json({ok:true});}
 if(path==='/admin/prepare'&&req.method==='GET'){const rows=await candidates(env);return json({digest:await digest(rows),works:rows.map(publicWork)});}
 if(path==='/admin/publish'&&req.method==='POST'){
   const form=await req.formData(),base=await publicManifest(env),rows=await candidates(env);ensure(rows.length>0,'Aprueba al menos una obra.');ensure(form.get('digest')===await digest(rows),'Las aprobaciones cambiaron. Vuelve a compilar.',409);
   const raw=form.get('groups');ensure(typeof raw==='string','Faltan los grupos.');const groups=JSON.parse(raw) as {ids:string[]}[];ensure(Array.isArray(groups)&&groups.length>0&&groups.length<=rows.length&&groups.every(g=>Array.isArray(g?.ids)&&g.ids.length>0),'Grupos inválidos.');ensure(JSON.stringify(groups.flatMap(x=>x.ids))===JSON.stringify(rows.map(x=>x.id)),'El orden de referencias no coincide con las obras.',409);
   const buffers:Uint8Array[]=[];
   for(let i=0;i<groups.length;i++){const file:unknown=form.get(`target${i}`);ensure(file instanceof File&&file.size>100&&file.size<=24*1024*1024,'Referencia .mind inválida.');const bytes=new Uint8Array(await file.arrayBuffer());let parsed:any;try{parsed=decode(bytes);}catch{throw new HttpError(400,'El archivo no es una referencia MindAR.');}ensure(parsed.v===2&&parsed.dataList?.length===groups[i].ids.length,'Número o versión de referencias incorrecto.');for(let j=0;j<groups[i].ids.length;j++){const row=rows.find(x=>x.id===groups[i].ids[j])!;const t=parsed.dataList[j];ensure(t.targetImage?.width===row.width&&t.targetImage?.height===row.height&&t.matchingData?.length>0&&t.trackingData?.length>0,'Referencia incompatible con su ilustración.');}buffers.push(bytes);}
   const id=crypto.randomUUID(),works=rows.map(publicWork);const manifest={id,createdAt:new Date().toISOString(),works,groups:groups.map((g,i)=>({id:i,target:`/api/targets/${id}/${i}.mind`,ids:g.ids}))};
   for(let i=0;i<buffers.length;i++)await env.MEDIA.put(`targets/${id}/${i}.mind`,buffers[i],{httpMetadata:{contentType:'application/octet-stream'}});
   // Re-check after compilation/upload; a publication is a single immutable snapshot.
   ensure(form.get('digest')===await digest(await candidates(env)),'Las obras cambiaron. Vuelve a preparar la publicación.',409);
   const committed=await env.DB.prepare("INSERT INTO publications(id,manifest) SELECT ?,? WHERE COALESCE((SELECT id FROM publications ORDER BY rowid DESC LIMIT 1),'')=?").bind(id,JSON.stringify(manifest),base.id||'').run();
   ensure(committed.meta.changes===1,'La galería recibió otra publicación. Vuelve a preparar la colección.',409);
   return json({ok:true,manifest});
 }
 throw new HttpError(404,'Ruta no encontrada.');
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);console.error(e);return json({error:'No pudimos completar la operación. Inténtalo de nuevo.'},500);}
}



