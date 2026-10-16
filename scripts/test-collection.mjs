import {authorizedFetch as fetch,unlockBrowser} from './access.mjs';
import {launch} from './browser.mjs';
import {decode,encode} from '@msgpack/msgpack';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:8790',referenceBase=process.env.REFERENCE_BASE||'http://127.0.0.1:8788';
assert.equal(new URL(base).hostname,'127.0.0.1','Usar una base local aislada');
assert.notEqual(base,referenceBase,'Separar la colección de prueba de las referencias locales');
await mkdir('output/collection',{recursive:true});
const source=await(await fetch(referenceBase+'/api/gallery')).json(),sourceWork=source.works.find(w=>w.demo&&w.slot===1);
assert.ok(sourceWork,'Se necesita la primera referencia de demostración local');
const group=source.groups.find(g=>g.ids.includes(sourceWork.id)),reference=decode(new Uint8Array(await(await fetch(referenceBase+group.target)).arrayBuffer()));
const target=encode({v:2,dataList:[reference.dataList[(group.sourceIds||group.ids).indexOf(sourceWork.id)]]});
const image=await readFile('public/demo/01.png'),video=await readFile('demo/videos/01.mp4');
async function request(path,cookie='',body){return fetch(base+'/api'+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{Origin:base,'Content-Type':body instanceof Uint8Array?'application/octet-stream':'application/json'}),...(body instanceof Uint8Array?{'X-Upload-Size':String(body.length)}:{})},...(body===undefined?{}:{body:body instanceof Uint8Array?body:JSON.stringify(body)})});}
async function seed(){
 const session=await request('/creator/new','',{});assert.equal(session.status,200);const cookie=session.headers.get('set-cookie').split(';')[0];
 const draft=await(await request('/creator/uploads',cookie,{})).json();
 for(const [kind,bytes]of [['image',image],['video',video]])assert.equal((await request(`/creator/uploads/${draft.id}/${kind}`,cookie,bytes)).status,200);
 const publish=await request(`/creator/uploads/${draft.id}/publish`,cookie,new Uint8Array(target));assert.equal(publish.status,200,await publish.clone().text());
 return draft.id;
}
assert.equal((await(await request('/gallery')).json()).works.length,0,'La colección de prueba debe empezar vacía');
const first=await seed(),second=await seed(),browser=await launch();
const checks=[];function ok(value,message){assert.ok(value,message);checks.push(message);console.log('✓',message);}
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await unlockBrowser(page.context(),base);await page.goto(base+'/#/obras');await page.locator('.pair-card').first().waitFor();
 ok(await page.locator('.pair-card').count()===2,'Cada pareja se presenta como una tarjeta');
 for(const card of await page.locator('.pair-card').all()){assert.equal(await card.locator('img').count(),1);assert.equal(await card.locator('video').count(),1);}
 ok(true,'Cada tarjeta contiene su imagen y su video');
 for(const width of [320,390,1366]){
  await page.setViewportSize({width,height:900});
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Parejas y botón sin desbordamiento a ${width} px`);
  await page.screenshot({path:`output/collection/pairs-${width}.png`,fullPage:true});
 }
 const link=page.getByRole('link',{name:'Ver colección',exact:true});
 ok(await link.evaluate(el=>getComputedStyle(el).borderTopColor)==='rgb(254, 246, 5)','El botón usa el amarillo de la marca');
 await link.hover();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.collection-link'),'::before').top==='-30px');
 await page.screenshot({path:'output/collection/button-hover.png'});
 ok(true,'El relleno circular se anima al pasar el cursor');
 await page.locator(`[data-delete="${first}"]`).click();await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 ok((await(await request('/gallery')).json()).works.length===2,'Cancelar conserva los dos archivos y la publicación');
 await page.locator(`[data-delete="${first}"]`).click();await page.getByRole('button',{name:'Borrar imagen y video',exact:true}).click();
 await page.waitForFunction(id=>!document.querySelector(`[data-pair="${id}"]`),first);
 ok((await request(`/media/${first}/image`)).status===404&&(await request(`/media/${first}/video`)).status===404,'Un visitante distinto borra la imagen y su video juntos');
 ok((await request(`/media/${second}/image`)).status===200&&(await request(`/media/${second}/video`)).status===200,'La otra pareja sigue disponible');
 await page.getByRole('link',{name:/Subir otra pareja/}).click();await page.getByRole('button',{name:'Publicar',exact:true}).waitFor();
 await page.getByLabel('Sube tu imagen inicial',{exact:true}).setInputFiles('public/demo/01.png');
 await page.getByLabel('Sube tu video',{exact:true}).setInputFiles('demo/videos/01.mp4');
 await page.getByRole('button',{name:'Publicar',exact:true}).click();
 await page.getByRole('heading',{name:'Pieza publicada con éxito.'}).waitFor({timeout:180000});
 const state=await(await page.request.post(base+'/api/creator/session',{headers:{Origin:base},data:{}})).json();
 ok(state.submission.slot_id===1,'La nueva pareja reutiliza el espacio liberado');
 const gallery=await(await request('/gallery')).json();ok(gallery.works.some(w=>w.id===second)&&gallery.works.length===2,'Publicar el reemplazo conserva la pareja restante');
 await page.getByRole('link',{name:'Ver colección',exact:true}).click();await page.locator('.pair-card').first().waitFor();
 for(const id of gallery.works.map(w=>w.id)){
  await page.locator(`[data-delete="${id}"]`).click();await page.getByRole('button',{name:'Borrar imagen y video',exact:true}).click();
  await page.waitForFunction(id=>!document.querySelector(`[data-pair="${id}"]`),id);
 }
 await page.getByText('Aún no hay contenido publicado',{exact:true}).waitFor();
 ok(await page.locator('.pair-card').count()===0,'La última eliminación muestra el mensaje vacío exacto');
 ok((await(await request('/gallery')).json()).groups.length===0,'Se retiran también las referencias de reconocimiento');
 ok(errors.length===0,'Sin errores de JavaScript');
 await writeFile('output/collection/results.json',JSON.stringify({passed:true,checks,date:new Date().toISOString()},null,2));
}finally{await browser.close();}
