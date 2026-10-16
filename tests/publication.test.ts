import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {encode} from '@msgpack/msgpack';
import {handle,hash,type Env} from '../server/api';

// Exercise the real handler against SQLite. A competing publication is
// inserted while the target is stored, exactly inside the former race window.
async function fixture(concurrent:boolean){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('migrations/0001.sql','utf8'));
 sqlite.prepare('INSERT INTO slots VALUES(1,?)').run('slot-hash');
 sqlite.prepare("INSERT INTO submissions(id,slot_id,name,title,image_key,video_key,width,height,duration,status) VALUES('work',1,'Autor','Obra','image','video',640,800,6,'approved')").run();
 const token='a'.repeat(64);sqlite.prepare("INSERT INTO sessions VALUES(?,'admin',NULL,?)").run(await hash(token),Date.now()+60000);
 sqlite.prepare('INSERT INTO publications(id,manifest) VALUES(?,?)').run('baseline',JSON.stringify({id:'baseline',works:[],groups:[]}));
 const db={prepare(sql:string){let args:any[]=[];const statement={bind(...values:any[]){args=values;return statement;},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){const result=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}};}};return statement;}};
 const env={DB:db,MEDIA:{async put(){if(concurrent)sqlite.prepare('INSERT INTO publications(id,manifest) VALUES(?,?)').run('competing',JSON.stringify({id:'competing',works:[],groups:[]}));}},ADMIN_CODE_SHA256:''} as unknown as Env;
 const headers={Origin:'http://localhost',Cookie:`umbral=${token}`};
 const prepared=await handle(new Request('http://localhost/api/admin/prepare',{headers}),env),snapshot=await prepared.json() as {digest:string};
 const form=new FormData();form.set('digest',snapshot.digest);form.set('groups',JSON.stringify([{ids:['work']}]));
 form.set('target0',new Blob([new Uint8Array(encode({v:2,dataList:[{targetImage:{width:640,height:800},matchingData:[{}],trackingData:[{}]}],padding:'x'.repeat(100)})).buffer]),'target.mind');
 const response=await handle(new Request('http://localhost/api/admin/publish',{method:'POST',headers,body:form}),env);
 return {sqlite,response};
}
test('Publicación del organizador guarda una colección sin cambios concurrentes',async()=>{
 const {sqlite,response}=await fixture(false);try{assert.equal(response.status,200);const data=await response.json() as any;assert.equal(data.manifest.works[0].id,'work');assert.equal(sqlite.prepare('SELECT id FROM publications ORDER BY rowid DESC LIMIT 1').get()?.id,data.manifest.id);}finally{sqlite.close();}
});
test('Publicación del organizador rechaza sobrescribir una publicación concurrente',async()=>{
 const {sqlite,response}=await fixture(true);try{assert.equal(response.status,409);assert.equal(sqlite.prepare('SELECT id FROM publications ORDER BY rowid DESC LIMIT 1').get()?.id,'competing');}finally{sqlite.close();}
});
