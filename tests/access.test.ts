import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handle,hash,type Env} from '../server/api';

async function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('migrations/0001.sql','utf8'));
 sqlite.prepare('INSERT INTO slots VALUES(1,?)').run('slot1');
 sqlite.prepare("INSERT INTO submissions(id,slot_id,name,title,image_key,video_key,width,height,duration,status) VALUES('work',1,'Autor','Título','image','video',640,800,30,'approved')").run();
 const manifest={id:'publication',works:[{id:'work',slot:1,name:'Autor',title:'Título',image:'/api/media/work/image',video:'/api/media/work/video',width:640,height:800}],groups:[{id:0,target:'/api/targets/publication/0.mind',ids:['work']}]};
 sqlite.prepare('INSERT INTO publications(id,manifest) VALUES(?,?)').run(manifest.id,JSON.stringify(manifest));
 const db={prepare(sql:string){let args:any[]=[];const s={bind(...v:any[]){args=v;return s;},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};return s;}};
 const env={DB:db,ACCESS_PIN_SHA256:await hash('2468'),ADMIN_CODE_SHA256:'',MEDIA:{async get(){return {body:new Uint8Array([1,2,3]),httpEtag:'"asset"',writeHttpMetadata(h:Headers){h.set('Content-Type','video/mp4');}};}}} as unknown as Env;
 const request=(path:string,body?:unknown,cookie='',origin='https://gallery.test')=>handle(new Request('https://gallery.test/api'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
 const unlock=async()=>{const response=await request('/access',{pin:'2468'});assert.equal(response.status,200);return response.headers.get('set-cookie')!.split(';')[0];};
 return {sqlite,env,request,unlock};
}
test('Sin PIN se bloquean la colección, sus imágenes y todas las vías de publicación y borrado',async()=>{
 const f=await fixture();try{
  for(const [path,body]of [['/gallery',undefined],['/media/work/image',undefined],['/creator/session',{}],['/creator/new',{}],['/creator/uploads',{}],['/collection/works/work/delete',{}],['/submit',{}],['/admin/publish',{}]] as const){assert.equal((await f.request(path,body)).status,401,path);}
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM uploads').get()?.n,0);assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM sessions').get()?.n,0);
 }finally{f.sqlite.close();}
});
test('El escáner y los videos publicados siguen disponibles sin mostrar imágenes ni títulos en su catálogo',async()=>{
 const f=await fixture();try{
  const response=await f.request('/scan');assert.equal(response.status,200);const scan=await response.json() as any;
  assert.deepEqual(Object.keys(scan.works[0]).sort(),['height','id','video','width']);assert.equal(scan.groups.length,1);
  assert.equal((await f.request('/media/work/video')).status,200);
 }finally{f.sqlite.close();}
});
test('El PIN incorrecto y las cookies inventadas no conceden acceso',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/access',{pin:'0000'})).status,401);
  assert.equal((await f.request('/access',{pin:2468})).status,401);
  assert.equal((await f.request('/gallery',undefined,`umbral_access=${'a'.repeat(64)}`)).status,401);
  const status=await(await f.request('/access/session')).json() as any;assert.equal(status.allowed,false);
 }finally{f.sqlite.close();}
});
test('El PIN correcto crea una sesión segura y permite ver la colección e iniciar una publicación',async()=>{
 const f=await fixture();try{
  const response=await f.request('/access',{pin:'2468'}),header=response.headers.get('set-cookie')!;assert.equal(response.status,200);
  assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Strict/);assert.match(header,/Secure/);assert.match(header,/Path=\/api/);assert.ok(!header.includes('2468'));
  const cookie=header.split(';')[0];assert.equal((await f.request('/gallery',undefined,cookie)).status,200);assert.equal((await f.request('/media/work/image',undefined,cookie)).status,200);
  assert.equal((await f.request('/creator/session',{},cookie)).status,200);
 }finally{f.sqlite.close();}
});
test('Una sesión de creador anterior no evita el PIN y las sesiones de acceso caducadas se rechazan',async()=>{
 const f=await fixture();try{
  const token='a'.repeat(64);f.sqlite.prepare("INSERT INTO sessions VALUES(?,'creator',1,?)").run(await hash(token),Date.now()+60000);
  assert.equal((await f.request('/creator/session',{},`umbral_creator=${token}`)).status,401);
  const cookie=await f.unlock();f.sqlite.prepare("UPDATE sessions SET expires=0 WHERE role='access'").run();
  assert.equal((await f.request('/gallery',undefined,cookie)).status,401);
 }finally{f.sqlite.close();}
});
test('El acceso rechaza otro origen y limita los intentos repetidos de PIN',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/access',{pin:'2468'},'','https://foreign.test')).status,403);
  for(let i=0;i<10;i++)assert.equal((await f.request('/access',{pin:'0000'})).status,401);
  assert.equal((await f.request('/access',{pin:'2468'})).status,429);
  f.sqlite.prepare('UPDATE attempts SET reset=0').run();assert.equal((await f.request('/access',{pin:'2468'})).status,200);
 }finally{f.sqlite.close();}
});
test('Si falta el secreto del servidor, el acceso queda cerrado',async()=>{
 const f=await fixture();try{f.env.ACCESS_PIN_SHA256='';assert.equal((await f.request('/access',{pin:'2468'})).status,503);assert.equal((await f.request('/gallery')).status,401);}finally{f.sqlite.close();}
});
