import type {Env} from './api';
import {ensure,HttpError} from './media';

type Manifest={id:string|null;createdAt?:string;works:any[];groups:{id:number;target:string;ids:string[];sourceIds?:string[]}[]};
type Deleted={id:string;image_key:string;video_key:string;target_keys:string;completed:number};
const manifest=async(env:Env):Promise<Manifest>=>{
 const row=await env.DB.prepare('SELECT manifest FROM publications ORDER BY rowid DESC LIMIT 1').first<{manifest:string}>();
 return row?JSON.parse(row.manifest):{id:null,works:[],groups:[]};
};
async function finishDeletion(env:Env,deleted:Deleted){
 if(!deleted.completed){
  try{await env.MEDIA.delete([deleted.image_key,deleted.video_key,...JSON.parse(deleted.target_keys)]);}
  catch{throw new HttpError(503,'La pareja ya se retiró. Vuelve a pulsar Borrar para terminar de eliminar sus archivos.');}
  await env.DB.prepare('UPDATE deleted_works SET completed=1 WHERE id=?').bind(deleted.id).run();
 }
 return Response.json({ok:true,id:deleted.id},{headers:{'Cache-Control':'no-store'}});
}

// A single transaction removes the complete pair from the current publication.
// Tombstones make retries safe and prevent an in-flight publication restoring it.
export async function deletePair(env:Env,id:string){
 for(let attempt=0;attempt<5;attempt++){
  const deleted=await env.DB.prepare('SELECT * FROM deleted_works WHERE id=?').bind(id).first<Deleted>();
  if(deleted)return finishDeletion(env,deleted);
  const row=await env.DB.prepare('SELECT id,slot_id,image_key,video_key FROM submissions WHERE id=?').bind(id).first<{id:string;slot_id:number;image_key:string;video_key:string}>();
  ensure(row,'Esta pareja ya no está disponible.',404);
  const base=await manifest(env);
  if(!base.works.some(w=>w.id===id)){
   const alreadyDeleted=await env.DB.prepare('SELECT * FROM deleted_works WHERE id=?').bind(id).first<Deleted>();
   if(alreadyDeleted)return finishDeletion(env,alreadyDeleted);
   throw new HttpError(404,'Esta pareja ya no está publicada. Actualiza la colección.');
  }
  const works=base.works.filter(w=>w.id!==id).map((w,index)=>({...w,index}));
  const groups=base.groups.map(g=>({...g,sourceIds:g.sourceIds||g.ids,ids:g.ids.filter(workId=>workId!==id)})).filter(g=>g.ids.length>0);
  const retainedTargets=new Set(groups.map(g=>g.target));
  const targetKeys=[...new Set([...base.groups.filter(g=>!retainedTargets.has(g.target)).map(g=>g.target),`/api/targets/${id}/0.mind`].filter(target=>!retainedTargets.has(target)).map(target=>target.replace(/^\/api\//,'')))];
  const publicationId=crypto.randomUUID();
  const next={id:publicationId,createdAt:new Date().toISOString(),works,groups};
  const committed=await env.DB.batch([
   env.DB.prepare("INSERT INTO publications(id,manifest) SELECT ?,? WHERE COALESCE((SELECT id FROM publications ORDER BY rowid DESC LIMIT 1),'')=?").bind(publicationId,JSON.stringify(next),base.id||''),
   env.DB.prepare('INSERT OR IGNORE INTO deleted_works(id,slot_id,image_key,video_key,target_keys) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM publications WHERE id=?)').bind(id,row.slot_id,row.image_key,row.video_key,JSON.stringify(targetKeys),publicationId),
   env.DB.prepare('DELETE FROM submissions WHERE id=? AND EXISTS(SELECT 1 FROM publications WHERE id=?)').bind(id,publicationId),
   env.DB.prepare('DELETE FROM uploads WHERE id=? AND EXISTS(SELECT 1 FROM publications WHERE id=?)').bind(id,publicationId),
   env.DB.prepare('UPDATE sessions SET slot_id=NULL WHERE slot_id=? AND NOT EXISTS(SELECT 1 FROM submissions WHERE slot_id=?) AND EXISTS(SELECT 1 FROM publications WHERE id=?)').bind(row.slot_id,row.slot_id,publicationId)
  ]);
  if(committed[0].meta.changes===1){
   const record=await env.DB.prepare('SELECT * FROM deleted_works WHERE id=?').bind(id).first<Deleted>();
   ensure(record,'No se pudo registrar la eliminación.',500);
   return finishDeletion(env,record);
  }
 }
 throw new HttpError(409,'La colección cambió mientras se borraba la pareja. Vuelve a intentarlo.');
}
