import {Buffer} from 'node:buffer';
import {decode} from '@msgpack/msgpack';
import {ensure,HttpError,imageInfo,videoInfo,validatePair} from './media';
import type {Env} from './api';

type Ticket={id:string;owner_hash:string;image_meta:string|null;video_meta:string|null;published:number;expires:number};
type Manifest={id:string|null;createdAt?:string;works:any[];groups:{id:number;target:string;ids:string[];sourceIds?:string[]}[]};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const readManifest=async(env:Env):Promise<Manifest>=>{const row=await env.DB.prepare('SELECT manifest FROM publications ORDER BY rowid DESC LIMIT 1').first<{manifest:string}>();return row?JSON.parse(row.manifest):{id:null,works:[],groups:[]};};
async function readLimited(req:Request,limit:number){
  ensure(req.body,'Falta el archivo.');const reader=req.body.getReader(),chunks:Uint8Array[]=[];let total=0;
  for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>limit){await reader.cancel();throw new HttpError(413,'El archivo supera el límite permitido.');}chunks.push(value);}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}

// Read only MP4 headers and its small metadata box. The 50 MB video itself
// streams directly to R2 and is never buffered in the Worker.
async function storedVideoInfo(env:Env,key:string,size:number){
  const read=async(offset:number,length:number)=>{const object=await env.MEDIA.get(key,{range:{offset,length}});ensure(object,'Video incompleto.');return Buffer.from(await object.arrayBuffer());};
  let offset=0,ftyp:Buffer|undefined,moov:Buffer|undefined,media=false,count=0;
  while(offset<size){
    ensure(++count<=30,'El MP4 contiene demasiadas cajas de nivel superior.');
    const header=await read(offset,Math.min(16,size-offset));ensure(header.length>=8,'MP4 incompleto.');
    let length=header.readUInt32BE(0),head=8;const type=header.toString('ascii',4,8);
    if(length===1){ensure(header.length>=16,'MP4 incompleto.');length=Number(header.readBigUInt64BE(8));head=16;}
    if(length===0)length=size-offset;
    ensure(length>=head&&offset+length<=size,'Estructura MP4 inválida.');
    if(type==='ftyp'){ensure(!ftyp&&length<=4096,'Cabecera MP4 inválida.');ftyp=await read(offset,length);}
    if(type==='moov'){ensure(!moov&&length<=2*1024*1024,'Los metadatos del MP4 superan 2 MB. Exporta de nuevo el video.');moov=await read(offset,length);}
    if(type==='mdat'&&length>head)media=true;
    offset+=length;
  }
  ensure(ftyp&&moov&&media,'Sube un MP4 completo con metadatos y video.');
  return videoInfo(Buffer.concat([ftyp,moov,Buffer.from([0,0,0,9,109,100,97,116,0])]));
}

export async function creatorPublication(req:Request,env:Env,ownerHash:string):Promise<Response>{
  ensure(req.method==='POST','Método no permitido.',405);
  ensure((await env.DB.prepare("SELECT value FROM settings WHERE key='closed'").first<{value:string}>())?.value!=='true','Las publicaciones están cerradas.',409);
  const path=new URL(req.url).pathname;
  if(path==='/api/creator/uploads'){
    const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM uploads WHERE owner_hash=? AND created_at>datetime('now','-1 day')").bind(ownerHash).first<{n:number}>();
    ensure((count?.n||0)<12,'Máximo 12 intentos de publicación por día.',429);
    const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO uploads(id,owner_hash,expires) VALUES (?,?,?)').bind(id,ownerHash,Date.now()+86400000).run();
    return json({id},201);
  }
  const match=path.match(/^\/api\/creator\/uploads\/([a-f0-9-]{36})\/(image|video|publish)$/);
  ensure(match,'Ruta de carga no encontrada.',404);
  const [,id,kind]=match;
  const ticket=await env.DB.prepare('SELECT * FROM uploads WHERE id=? AND owner_hash=? AND expires>?').bind(id,ownerHash,Date.now()).first<Ticket>();
  ensure(ticket,'La carga expiró o pertenece a otro navegador.',403);
  if(kind==='image'||kind==='video'){
    ensure(!ticket.published&&!await env.DB.prepare('SELECT id FROM submissions WHERE id=?').bind(id).first(),'Esta versión ya está preparada para publicar.',409);
    const assetKey=`private/${id}/${kind}-${crypto.randomUUID()}`;
    const limit=(kind==='image'?12:50)*1024*1024;
    const size=Number(req.headers.get('X-Upload-Size')||req.headers.get('Content-Length'));
    ensure(Number.isSafeInteger(size)&&size>0&&size<=limit,`Máximo ${kind==='image'?'12 MB para la imagen':'50 MB para el video'}.`,413);
    if(kind==='image'){
      const bytes=await readLimited(req,limit);ensure(bytes.length===size,'Tamaño de imagen inválido.');
      const meta=imageInfo(bytes);await env.MEDIA.put(assetKey,bytes,{httpMetadata:{contentType:meta.mime}});
      await env.DB.prepare('UPDATE uploads SET image_meta=? WHERE id=?').bind(JSON.stringify({...meta,key:assetKey}),id).run();
    }else{
      ensure(req.body,'Falta el video.');
      const fixed=new FixedLengthStream(size);
      try{
        await Promise.all([req.body.pipeTo(fixed.writable),env.MEDIA.put(assetKey,fixed.readable,{httpMetadata:{contentType:'video/mp4'}})]);
        const meta=await storedVideoInfo(env,assetKey,size);
        await env.DB.prepare('UPDATE uploads SET video_meta=? WHERE id=?').bind(JSON.stringify({...meta,key:assetKey}),id).run();
      }catch(error){await env.MEDIA.delete(assetKey);if(error instanceof HttpError)throw error;throw new HttpError(400,'No se pudo completar el video. Vuelve a seleccionarlo e inténtalo de nuevo.');}
    }
    return json({ok:true});
  }

  const current=await readManifest(env);
  if(current.works.some(w=>w.id===id))return json({ok:true,id,published:true});
  ensure(!ticket.published,'Esta versión ya fue reemplazada.',409);
  ensure(ticket.image_meta&&ticket.video_meta,'Falta subir la imagen o el video.');
  const image=JSON.parse(ticket.image_meta),video=JSON.parse(ticket.video_meta);validatePair(image,video);
  ensure(Number(req.headers.get('Content-Length')||0)<=8*1024*1024,'La referencia es demasiado grande.',413);
  const bytes=await readLimited(req,8*1024*1024);ensure(bytes.length>100,'Referencia inválida.');
  let reference:any;try{reference=decode(bytes);}catch{throw new HttpError(400,'La referencia no se pudo preparar.');}
  const target=reference.dataList?.[0];
  ensure(reference.v===2&&reference.dataList?.length===1&&target?.targetImage,'La referencia debe contener una sola imagen.');
  const dims=target.targetImage;
  ensure(dims.width>0&&dims.height>0&&dims.width<=1024&&dims.height<=1024,'Dimensiones de referencia inválidas.');
  ensure(Math.abs(dims.width/dims.height-image.width/image.height)/(image.width/image.height)<0.01,'La referencia no coincide con las proporciones de la imagen.');
  ensure(target.matchingData?.length>0&&target.trackingData?.length>0,'No se pudieron encontrar detalles reconocibles.');
  const points=Math.max(...target.matchingData.map((frame:any)=>(frame.maximaPoints?.length||0)+(frame.minimaPoints?.length||0)));
  ensure(points>=20,'La imagen tiene muy pocos detalles para reconocerla. Usa una ilustración con más contraste.');
  await env.DB.prepare("UPDATE sessions SET slot_id=(SELECT slots.id FROM slots WHERE NOT EXISTS(SELECT 1 FROM submissions WHERE submissions.slot_id=slots.id) AND NOT EXISTS(SELECT 1 FROM sessions reserved WHERE reserved.slot_id=slots.id AND reserved.expires>?) ORDER BY slots.id LIMIT 1) WHERE hash=? AND slot_id IS NULL AND expires>?").bind(Date.now(),ownerHash,Date.now()).run();
  const person=await env.DB.prepare('SELECT slot_id FROM sessions WHERE hash=? AND expires>?').bind(ownerHash,Date.now()).first<{slot_id:number|null}>();
  ensure(person?.slot_id!==null&&person?.slot_id!==undefined,'El proyecto ya tiene sus 22 espacios ocupados.',409);
  const slot=person.slot_id;
  const previous=await env.DB.prepare('SELECT name,title FROM submissions WHERE slot_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').bind(slot).first<{name:string;title:string}>();
  const name=previous?.name||`Participante ${String(slot).padStart(2,'0')}`,title=previous?.title||`Obra ${String(slot).padStart(2,'0')}`;
  await env.DB.prepare("INSERT OR IGNORE INTO submissions(id,slot_id,name,title,image_key,video_key,width,height,duration,status) VALUES (?,?,?,?,?,?,?,?,?,'pending')").bind(id,slot,name,title,image.key,video.key,image.width,image.height,video.duration).run();
  await env.MEDIA.put(`targets/${id}/0.mind`,bytes,{httpMetadata:{contentType:'application/octet-stream'}});
  for(let attempt=0;attempt<5;attempt++){
    const base=await readManifest(env);
    if(base.works.some(w=>w.id===id))return json({ok:true,id,published:true});
    const works=[...base.works.filter(w=>w.slot!==slot),{id,slot,name,title,width:image.width,height:image.height,demo:false,image:`/api/media/${id}/image`,video:`/api/media/${id}/video`}].sort((a,b)=>a.slot-b.slot).map((w,index)=>({...w,index}));
    const ids=new Set(works.map(w=>w.id));
    const groups=base.groups.map(g=>({...g,sourceIds:g.sourceIds||g.ids,ids:g.ids.filter(workId=>ids.has(workId))})).filter(g=>g.ids.length>0);
    groups.push({id:Math.max(-1,...groups.map(g=>g.id))+1,target:`/api/targets/${id}/0.mind`,ids:[id],sourceIds:[id]});
    const publicationId=crypto.randomUUID(),manifest={id:publicationId,createdAt:new Date().toISOString(),works,groups};
    // Compare-and-insert inside SQLite prevents two simultaneous publishers
    // from overwriting each other's completed pieces.
    const committed=await env.DB.batch([
      env.DB.prepare("INSERT INTO publications(id,manifest) SELECT ?,? WHERE COALESCE((SELECT id FROM publications ORDER BY rowid DESC LIMIT 1),'')=? AND (SELECT value FROM settings WHERE key='closed')='false'").bind(publicationId,JSON.stringify(manifest),base.id||''),
      env.DB.prepare("UPDATE submissions SET status='approved',active=1 WHERE id=? AND EXISTS(SELECT 1 FROM publications WHERE id=?)").bind(id,publicationId),
      env.DB.prepare('UPDATE uploads SET published=1 WHERE id=? AND EXISTS(SELECT 1 FROM publications WHERE id=?)').bind(id,publicationId)
    ]);
    if(committed[0].meta.changes===1)return json({ok:true,id,slot,published:true});
    ensure((await env.DB.prepare("SELECT value FROM settings WHERE key='closed'").first<{value:string}>())?.value!=='true','Las publicaciones se cerraron durante la carga.',409);
  }
  throw new HttpError(409,'La galería está recibiendo otra publicación. Vuelve a pulsar Publicar.');
}
