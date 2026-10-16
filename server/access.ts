import type {Env} from './api';
import {ensure} from './media';

const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const json=(data:unknown,status=200,headers:HeadersInit={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
export async function hasAccess(req:Request,env:Env){
 if(!env.ACCESS_PIN_SHA256)return false;
 const token=req.headers.get('Cookie')?.match(/(?:^|; )umbral_access=([a-f0-9]{64})/)?.[1];
 if(!token)return false;
 const session=await env.DB.prepare("SELECT hash FROM sessions WHERE hash=? AND role='access' AND expires>?").bind(await digest(token),Date.now()).first();
 return !!session;
}
export async function unlock(req:Request,env:Env){
 ensure(env.ACCESS_PIN_SHA256,'El acceso todavía no está configurado.',503);
 const key=await digest('pin:'+(req.headers.get('CF-Connecting-IP')||'local'));
 const attempt=await env.DB.prepare('SELECT count,reset FROM attempts WHERE key=?').bind(key).first<{count:number;reset:number}>();
 ensure(!attempt||attempt.reset<Date.now()||attempt.count<10,'Demasiados intentos. Vuelve a intentarlo en 15 minutos.',429);
 await env.DB.prepare('INSERT INTO attempts(key,count,reset) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset<? THEN 1 ELSE count+1 END,reset=CASE WHEN reset<? THEN excluded.reset ELSE reset END').bind(key,Date.now()+900000,Date.now(),Date.now()).run();
 const data=await req.json() as {pin?:unknown};
 ensure(typeof data.pin==='string'&&/^\d{4}$/.test(data.pin)&&await digest(data.pin)===env.ACCESS_PIN_SHA256,'PIN incorrecto',401);
 await env.DB.prepare('DELETE FROM attempts WHERE key=?').bind(key).run();
 const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
 await env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()).run();
 await env.DB.prepare("INSERT INTO sessions(hash,role,slot_id,expires) VALUES (?,'access',NULL,?)").bind(await digest(token),Date.now()+8*3600000).run();
 return json({ok:true},200,{'Set-Cookie':`umbral_access=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=28800${new URL(req.url).protocol==='https:'?'; Secure':''}`});
}
export const accessStatus=async(req:Request,env:Env)=>json({allowed:await hasAccess(req,env)});
