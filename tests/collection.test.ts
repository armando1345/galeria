import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handle,hash,type Env} from '../server/api';
import {reserveSpace} from '../server/spaces';
import {creatorPublication} from '../server/creator-publication';
import {deletePair} from '../server/collection';
import {HttpError} from '../server/media';
import {encode} from '@msgpack/msgpack';

async function fixture(shared=false){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('migrations/0001.sql','utf8'));
 for(const n of [1,2]){
  sqlite.prepare('INSERT INTO slots VALUES(?,?)').run(n,'slot-'+n);
  sqlite.prepare("INSERT INTO submissions(id,slot_id,name,title,image_key,video_key,width,height,duration,status) VALUES(?,?,'Autor','Obra',?,?,640,800,6,'approved')").run('piece'+n,n,`private/piece${n}/image`,`private/piece${n}/video`);
 }
 const owner='a'.repeat(64),visitor='b'.repeat(64),ownerHash=await hash(owner);
 sqlite.prepare("INSERT INTO sessions VALUES(?,'access',NULL,?)").run(await hash('c'.repeat(64)),Date.now()+60000);
 sqlite.prepare("INSERT INTO sessions VALUES(?,'creator',1,?)").run(ownerHash,Date.now()+60000);
 sqlite.prepare("INSERT INTO sessions VALUES(?,'creator',NULL,?)").run(await hash(visitor),Date.now()+60000);
 sqlite.prepare('INSERT INTO uploads(id,owner_hash,expires,published) VALUES(?,?,?,1)').run('piece1',ownerHash,Date.now()+60000);
 const works=[1,2].map(n=>({id:'piece'+n,slot:n,index:n-1}));
 const groups=shared?[{id:0,target:'/api/targets/shared/0.mind',ids:['piece1','piece2']}]:[1,2].map(n=>({id:n-1,target:`/api/targets/piece${n}/0.mind`,ids:['piece'+n]}));
 sqlite.prepare('INSERT INTO publications(id,manifest) VALUES(?,?)').run('base',JSON.stringify({id:'base',works,groups}));
 const objects=new Set(['private/piece1/image','private/piece1/video','private/piece2/image','private/piece2/video',...(shared?['targets/shared/0.mind']:['targets/piece1/0.mind','targets/piece2/0.mind'])]);
 let concurrent:(()=>void)|undefined,failStorage=false;
 const db={prepare(sql:string){let args:any[]=[];const s={bind(...values:any[]){args=values;return s;},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};return s;},async batch(statements:any[]){if(concurrent){const hook=concurrent;concurrent=undefined;hook();}sqlite.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
 const env={DB:db,MEDIA:{async delete(keys:string|string[]){if(failStorage)throw Error('Storage unavailable');for(const key of Array.isArray(keys)?keys:[keys])objects.delete(key);}},ADMIN_CODE_SHA256:'',ACCESS_PIN_SHA256:await hash('2468')} as unknown as Env;
 const request=(id:string,token=visitor,origin='https://gallery.test')=>handle(new Request(`https://gallery.test/api/collection/works/${id}/delete`,{method:'POST',headers:{Origin:origin,...(token?{Cookie:`umbral_creator=${token}; umbral_access=${'c'.repeat(64)}`}:{})},body:'{}'}),env);
 const current=()=>JSON.parse(sqlite.prepare('SELECT manifest FROM publications ORDER BY rowid DESC LIMIT 1').get()!.manifest as string);
 return {sqlite,env,objects,ownerHash,request,current,setConcurrent(hook:()=>void){concurrent=hook;},setStorageFailure(value:boolean){failStorage=value;}};
}

test('Cualquier visitante con sesión automática puede borrar una pareja ajena completa',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('piece1')).status,200);
  assert.deepEqual(f.current().works.map((w:any)=>w.id),['piece2']);
  assert.ok(!f.objects.has('private/piece1/image'));assert.ok(!f.objects.has('private/piece1/video'));assert.ok(!f.objects.has('targets/piece1/0.mind'));
  assert.ok(f.objects.has('private/piece2/image'));assert.ok(f.objects.has('private/piece2/video'));
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM submissions WHERE id='piece1'").get()?.n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM uploads WHERE id='piece1'").get()?.n,0);
  assert.equal(f.sqlite.prepare('SELECT slot_id FROM sessions WHERE hash=?').get(f.ownerHash)?.slot_id,null);
  assert.equal(await reserveSpace(f.env,f.ownerHash),1,'El espacio se puede reutilizar');
 }finally{f.sqlite.close();}
});
test('Borrar una pareja conserva la referencia compartida y sus índices originales',async()=>{
 const f=await fixture(true);try{
  assert.equal((await f.request('piece1')).status,200);
  assert.deepEqual(f.current().groups[0].ids,['piece2']);assert.deepEqual(f.current().groups[0].sourceIds,['piece1','piece2']);
  assert.ok(f.objects.has('targets/shared/0.mind'));
  assert.equal((await f.request('piece2')).status,200);
  assert.deepEqual(f.current().works,[]);assert.deepEqual(f.current().groups,[]);assert.equal(f.objects.size,0);
 }finally{f.sqlite.close();}
});
test('Reintentar un borrado terminado no elimina ni altera otra pareja',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('piece1')).status,200);const id=f.current().id;
  assert.equal((await f.request('piece1')).status,200);assert.equal(f.current().id,id);assert.equal(f.objects.size,3);
 }finally{f.sqlite.close();}
});
test('Un fallo de almacenamiento conserva el trabajo pendiente y permite terminar el borrado',async()=>{
 const f=await fixture();try{
  f.setStorageFailure(true);assert.equal((await f.request('piece1')).status,503);
  assert.ok(!f.current().works.some((w:any)=>w.id==='piece1'));
  assert.equal(f.sqlite.prepare("SELECT completed FROM deleted_works WHERE id='piece1'").get()?.completed,0);
  f.setStorageFailure(false);assert.equal((await f.request('piece1')).status,200);
  assert.ok(!f.objects.has('private/piece1/image'));assert.ok(!f.objects.has('private/piece1/video'));
  assert.equal(f.sqlite.prepare("SELECT completed FROM deleted_works WHERE id='piece1'").get()?.completed,1);
 }finally{f.sqlite.close();}
});
test('Una publicación simultánea no se pierde al borrar otra pareja',async()=>{
 const f=await fixture();try{
  f.setConcurrent(()=>{const next=f.current();next.id='concurrent';next.works.push({id:'new-piece',slot:3,index:2});f.sqlite.prepare('INSERT INTO publications(id,manifest) VALUES(?,?)').run(next.id,JSON.stringify(next));});
  assert.equal((await f.request('piece1')).status,200);
  assert.deepEqual(f.current().works.map((w:any)=>w.id),['piece2','new-piece']);
 }finally{f.sqlite.close();}
});
test('No permite borrados desde otro origen ni sin la sesión automática',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('piece1','b'.repeat(64),'https://foreign.test')).status,403);
  assert.equal((await f.request('piece1','')).status,401);assert.equal((await f.request('unknown')).status,404);
  assert.equal(f.current().works.length,2);assert.equal(f.objects.size,6);
 }finally{f.sqlite.close();}
});
test('Los archivos privados sin publicar no se pueden borrar desde la colección compartida',async()=>{
 const f=await fixture();try{
  const next=f.current();next.id='replacement';next.works=next.works.filter((w:any)=>w.id!=='piece1');f.sqlite.prepare('INSERT INTO publications(id,manifest) VALUES(?,?)').run(next.id,JSON.stringify(next));
  assert.equal((await f.request('piece1')).status,404);assert.ok(f.objects.has('private/piece1/image'));
 }finally{f.sqlite.close();}
});
test('Una publicación en curso no puede restaurar una pareja que otro visitante acaba de borrar',async()=>{
 const f=await fixture();try{
  const id='12345678-1234-1234-1234-123456789abc',owner=await hash('b'.repeat(64));
  f.sqlite.prepare('INSERT INTO uploads(id,owner_hash,image_meta,video_meta,expires) VALUES(?,?,?,?,?)').run(id,owner,JSON.stringify({key:`private/${id}/image`,width:640,height:800}),JSON.stringify({key:`private/${id}/video`,width:640,height:800,duration:6}),Date.now()+60000);
  f.objects.add(`private/${id}/image`);f.objects.add(`private/${id}/video`);
  (f.env.MEDIA as any).put=async(key:string)=>{
   f.objects.add(key);const row=f.sqlite.prepare('SELECT slot_id FROM submissions WHERE id=?').get(id)!;
   const next=f.current();next.id='published-by-another-request';next.works.push({id,slot:row.slot_id,index:2});next.groups.push({id:2,target:`/api/targets/${id}/0.mind`,ids:[id]});
   f.sqlite.prepare('INSERT INTO publications(id,manifest) VALUES(?,?)').run(next.id,JSON.stringify(next));
   await deletePair(f.env,id);
  };
  const reference=encode({v:2,dataList:[{targetImage:{width:640,height:800},matchingData:[{maximaPoints:Array(20).fill({})}],trackingData:[{}]}],padding:'x'.repeat(200)});
  await assert.rejects(creatorPublication(new Request(`https://gallery.test/api/creator/uploads/${id}/publish`,{method:'POST',body:new Uint8Array(reference).buffer}),f.env,owner),error=>error instanceof HttpError&&error.status===410);
  assert.ok(!f.current().works.some((w:any)=>w.id===id));assert.ok(!f.objects.has(`private/${id}/image`));assert.ok(!f.objects.has(`private/${id}/video`));
 }finally{f.sqlite.close();}
});
test('Empezar otra pareja conserva las publicaciones anteriores del mismo navegador',async()=>{
 const f=await fixture();try{
  const response=await handle(new Request('https://gallery.test/api/creator/new',{method:'POST',headers:{Origin:'https://gallery.test',Cookie:`umbral_creator=${'a'.repeat(64)}; umbral_access=${'c'.repeat(64)}`},body:'{}'}),f.env);
  assert.equal(response.status,200);const data=await response.json() as any;assert.equal(data.slot,null);assert.equal(data.submission,null);
  assert.ok(response.headers.get('set-cookie')?.includes('HttpOnly'));assert.equal(f.current().works.length,2);
  assert.equal(f.sqlite.prepare('SELECT slot_id FROM sessions WHERE hash=?').get(f.ownerHash)?.slot_id,1);
 }finally{f.sqlite.close();}
});
test('Una carga que termina después del borrado no deja un archivo de imagen huérfano',async()=>{
 const f=await fixture();try{
  const id='12345678-1234-1234-1234-123456789abc',owner=await hash('b'.repeat(64));
  f.sqlite.prepare('INSERT INTO uploads(id,owner_hash,expires) VALUES(?,?,?)').run(id,owner,Date.now()+60000);
  let uploadedKey='';
  (f.env.MEDIA as any).put=async(key:string)=>{
   uploadedKey=key;f.objects.add(key);f.sqlite.prepare('INSERT INTO slots VALUES(3,?)').run('slot-3');
   f.sqlite.prepare("INSERT INTO submissions(id,slot_id,name,title,image_key,video_key,width,height,duration,status) VALUES(?,3,'Autor','Obra','previous-image','previous-video',640,800,6,'approved')").run(id);
   const next=f.current();next.id='published-then-deleted';next.works.push({id,slot:3,index:2});
   f.sqlite.prepare('INSERT INTO publications(id,manifest) VALUES(?,?)').run(next.id,JSON.stringify(next));
   await deletePair(f.env,id);
  };
  const image=readFileSync('public/demo/01.png');
  await assert.rejects(creatorPublication(new Request(`https://gallery.test/api/creator/uploads/${id}/image`,{method:'POST',headers:{'X-Upload-Size':String(image.length)},body:new Uint8Array(image).buffer}),f.env,owner),error=>error instanceof HttpError&&error.status===409);
  assert.ok(uploadedKey);assert.ok(!f.objects.has(uploadedKey));assert.equal(f.current().works.length,2);
 }finally{f.sqlite.close();}
});
