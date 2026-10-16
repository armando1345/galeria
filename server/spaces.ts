import type {Env} from './api';
import {ensure} from './media';

// D1 batches are transactions: opening a new space and reserving it happen
// together, so concurrent creators cannot share the same space.
export async function reserveSpace(env:Env,ownerHash:string):Promise<number>{
 const now=Date.now();
 const free="SELECT slots.id FROM slots WHERE NOT EXISTS(SELECT 1 FROM submissions WHERE submissions.slot_id=slots.id) AND NOT EXISTS(SELECT 1 FROM sessions reserved WHERE reserved.slot_id=slots.id AND reserved.expires>?) ORDER BY slots.id LIMIT 1";
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO slots(id,token_hash) SELECT COALESCE(MAX(id),0)+1,? FROM slots HAVING EXISTS(SELECT 1 FROM sessions WHERE hash=? AND role='creator' AND slot_id IS NULL AND expires>?) AND NOT EXISTS(${free})`).bind('auto:'+crypto.randomUUID(),ownerHash,now,now),
  env.DB.prepare(`UPDATE sessions SET slot_id=(${free}) WHERE hash=? AND role='creator' AND slot_id IS NULL AND expires>?`).bind(now,ownerHash,now)
 ]);
 const person=await env.DB.prepare("SELECT slot_id FROM sessions WHERE hash=? AND role='creator' AND expires>?").bind(ownerHash,now).first<{slot_id:number|null}>();
 ensure(person?.slot_id!==null&&person?.slot_id!==undefined,'No se pudo asignar un espacio. Vuelve a intentarlo.',409);
 return person.slot_id;
}
