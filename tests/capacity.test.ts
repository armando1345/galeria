import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {reserveSpace} from '../server/spaces';
import type {Env} from '../server/api';

const schema=readFileSync('migrations/0001.sql','utf8'),upgrade=readFileSync('migrations/0003_expand_spaces.sql','utf8');
function binding(sqlite:DatabaseSync){
 const prepare=(sql:string)=>{let args:any[]=[];const s={bind(...a:any[]){args=a;return s;},first(){return Promise.resolve(sqlite.prepare(sql).get(...args)||null);},run(){const result=sqlite.prepare(sql).run(...args);return Promise.resolve({meta:{changes:Number(result.changes)}});}};return s;};
 const db={prepare,batch(statements:ReturnType<typeof prepare>[]){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.run());sqlite.exec('COMMIT');return Promise.all(result);}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 return {DB:db} as unknown as Env;
}
test('Migrar los 22 espacios conserva entregas, accesos, sesiones y publicación',()=>{
 const db=new DatabaseSync(':memory:');try{
 db.exec(schema.replace('CHECK(id >= 1)','CHECK(id BETWEEN 1 AND 22)'));
 for(let id=1;id<=22;id++)db.prepare('INSERT INTO slots VALUES(?,?)').run(id,'original-'+id);
 db.exec("INSERT INTO submissions(id,slot_id,name,title,image_key,video_key,width,height,duration) VALUES('old',22,'Autor','Obra','image','video',640,800,6);INSERT INTO sessions VALUES('owner','creator',22,9999999999999);INSERT INTO publications(id,manifest) VALUES('public','{\"works\":[{\"id\":\"old\"}]}');");
 const snapshot=['submissions','sessions','publications'].map(t=>db.prepare(`SELECT * FROM ${t}`).all());
 for(let pass=0;pass<2;pass++){db.exec('BEGIN');db.exec(upgrade);db.exec('COMMIT');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM slots').get()?.n,40);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);}
 assert.deepEqual(['submissions','sessions','publications'].map(t=>db.prepare(`SELECT * FROM ${t}`).all()),snapshot);
 assert.equal(db.prepare('SELECT token_hash FROM slots WHERE id=22').get()?.token_hash,'original-22');
 db.prepare('INSERT INTO slots VALUES(?,?)').run(41,'extra');assert.throws(()=>db.prepare('INSERT INTO slots VALUES(?,?)').run(0,'invalid'));
 }finally{db.close();}
});
test('50 creadores simultáneos obtienen espacios únicos, incluidos los posteriores a 40',async()=>{
 const db=new DatabaseSync(':memory:');try{
 db.exec(schema);db.exec('BEGIN');db.exec(upgrade);db.exec('COMMIT');const env=binding(db),owners=Array.from({length:50},(_,i)=>'owner-'+i);
 for(const owner of owners)db.prepare("INSERT INTO sessions VALUES(?,'creator',NULL,?)").run(owner,Date.now()+60000);
 const ids=await Promise.all(owners.map(owner=>reserveSpace(env,owner)));
 assert.equal(new Set(ids).size,50);assert.equal(Math.max(...ids),50);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM slots').get()?.n,50);
 assert.equal(await reserveSpace(env,owners[0]),ids[0]);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM slots').get()?.n,50);
 await assert.rejects(reserveSpace(env,'missing'),/No se pudo asignar/);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM slots').get()?.n,50);
 }finally{db.close();}
});
