import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

export async function testPin(){
 const pin=(process.env.TEST_PIN||await readFile('private/pin-acceso.txt','utf8')).trim();
 assert.match(pin,/^\d{4}$/,'Configura TEST_PIN o private/pin-acceso.txt con el PIN local');return pin;
}
export async function unlockCookie(base){
 const response=await globalThis.fetch(base+'/api/access',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({pin:await testPin()})});
 assert.equal(response.status,200,'No se pudo abrir la sesión de acceso de prueba');
 return response.headers.get('set-cookie').split(';')[0];
}
const sessions=new Map();
export async function authorizedFetch(input,init={}){
 const url=new URL(input);
 assert.ok(['127.0.0.1','localhost'].includes(url.hostname),'Las pruebas de contenido solo pueden usar servidores locales');
 if(!sessions.has(url.origin))sessions.set(url.origin,unlockCookie(url.origin));
 const cookie=await sessions.get(url.origin),headers=new Headers(init.headers);
 headers.set('Cookie',[headers.get('Cookie'),cookie].filter(Boolean).join('; '));
 return globalThis.fetch(input,{...init,headers});
}
export async function unlockBrowser(context,base){
 const response=await context.request.post(base+'/api/access',{headers:{Origin:base},data:{pin:await testPin()}});
 assert.equal(response.status(),200,'No se pudo abrir la sesión de acceso del navegador');
}
