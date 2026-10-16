import {authorizedFetch as fetch} from './access.mjs';
import assert from 'node:assert/strict';
import {decode,encode} from '@msgpack/msgpack';
import {writeFile} from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:8790';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Solo ejecutar en una copia local de pruebas.');
async function req(path,cookie,body,ip){const raw=body instanceof Uint8Array,r=await fetch(base+'/api'+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{Cookie:cookie}:{}),...(ip?{'CF-Connecting-IP':ip}:{}),...(body===undefined?{}:{Origin:base,'Content-Type':raw?'application/octet-stream':'application/json'}),...(raw?{'X-Upload-Size':String(body.length)}:{})},...(body===undefined?{}:{body:raw?body:JSON.stringify(body)})});const data=await r.json();assert.ok(r.ok,`${path}: ${r.status} ${data.error||''}`);return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const before=(await req('/gallery')).data,work=before.works.find(w=>w.demo);assert.ok(work,'Se necesita una demo publicada como fixture.');
const group=before.groups.find(g=>g.ids.includes(work.id)),reference=decode(new Uint8Array(await(await fetch(base+group.target)).arrayBuffer()));
const target=encode({v:2,dataList:[reference.dataList[(group.sourceIds||group.ids).indexOf(work.id)]]});
const image=new Uint8Array(await(await fetch(base+work.image)).arrayBuffer()),video=new Uint8Array(await(await fetch(base+work.video)).arrayBuffer());
const published=[];
for(let offset=0;offset<50;offset+=3){
 const results=await Promise.all(Array.from({length:Math.min(3,50-offset)},async(_,index)=>{
  const ip=`192.0.2.${offset+index+1}`,{cookie}=await req('/creator/session','',{},ip),{data:ticket}=await req('/creator/uploads',cookie,{},ip);
  await req(`/creator/uploads/${ticket.id}/image`,cookie,image,ip);await req(`/creator/uploads/${ticket.id}/video`,cookie,video,ip);
  const {data}=await req(`/creator/uploads/${ticket.id}/publish`,cookie,target,ip);return {id:ticket.id,slot:data.slot};
 }));published.push(...results);console.log(`${published.length}/50 obras de prueba publicadas`);
}
const after=(await req('/gallery')).data;
assert.equal(new Set(published.map(w=>w.slot)).size,50);assert.ok(Math.max(...published.map(w=>w.slot))>40);
for(const old of before.works)assert.ok(after.works.some(w=>w.id===old.id));for(const item of published)assert.ok(after.works.some(w=>w.id===item.id));
await writeFile('output/capacity-tests.json',JSON.stringify({passed:true,date:new Date().toISOString(),base,published:published.length,works:after.works.length,highestSlot:Math.max(...published.map(w=>w.slot)),previousWorksPreserved:true,fixtures:'Una referencia repetida para probar almacenamiento y publicación; no prueba reconocimiento de 50 imágenes distintas',ids:published.map(w=>w.id)},null,2));
console.log('50 publicaciones reales aprobadas, sin colisiones ni pérdida de las anteriores.');
