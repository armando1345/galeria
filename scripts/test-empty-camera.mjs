import {launch} from './browser.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:8788';
const browser=await launch(['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']);
await mkdir('output/empty-camera',{recursive:true});
const checks=[];const ok=(v,m)=>{assert.ok(v,m);checks.push(m);console.log('✓',m);};
try{
 const context=await browser.newContext({permissions:['camera'],viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],targets=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\.mind|vendor\/mindar/.test(r.url()))targets.push(r.url());});
 await page.route('**/api/gallery',r=>r.fulfill({json:{id:null,works:[],groups:[]}}));
 await page.goto(base);
 const link=page.getByRole('link',{name:'Ver colección',exact:true});ok(await link.isVisible(),'Ver colección visible en el encabezado');
 await link.click();await page.getByRole('heading',{name:'Imágenes y sus animaciones',exact:true}).waitFor();
 ok(true,'El botón lleva directamente a la colección');
 for(const width of [320,390,1366]){
  await page.setViewportSize({width,height:844});
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`El encabezado no desborda a ${width} px`);
 }
 await page.setViewportSize({width:390,height:844});await page.goto(base);
 await page.getByRole('button',{name:'Ver obra con realidad aumentada',exact:true}).click();
 const iframe=page.frameLocator('.scanner-overlay iframe');
 await iframe.getByRole('button',{name:'Entendido',exact:true}).waitFor();
 let frame=await(await page.locator('.scanner-overlay iframe').elementHandle()).contentFrame();
 await frame.waitForFunction(()=>document.body.dataset.scanner==='ready'&&document.body.dataset.camera==='environment');
 ok(await frame.evaluate(()=>{const v=document.querySelector('#scene video');return !v.paused&&v.readyState>=2&&v.srcObject.getVideoTracks().some(t=>t.readyState==='live');}),'La cámara está abierta y reproduce imagen con la galería vacía');
 ok(await iframe.locator('#scan-error:visible').count()===0,'Sin aviso de referencias vacías');
 ok(await iframe.locator('#restart,a[href*="obras"]').count()===0,'Sin Reiniciar cámara ni enlace de animaciones sin cámara');
 await page.screenshot({path:'output/empty-camera/onboarding.png'});
 await iframe.getByRole('button',{name:'Entendido',exact:true}).click();
 ok(await iframe.locator('#onboarding').count()===0,'Entendido elimina el aviso inicial');
 ok(!/referencias|reiniciar|sin cámara|apunta/i.test(await iframe.locator('#scanner-ui').innerText()),'La cámara queda libre de mensajes');
 await page.screenshot({path:'output/empty-camera/clear.png'});
 await frame.evaluate(()=>{parent.__emptyOldTracks=document.querySelector('#scene video').srcObject.getTracks();});
 await iframe.getByRole('button',{name:'Usar cámara frontal',exact:true}).click();
 await iframe.getByRole('button',{name:'Usar cámara trasera',exact:true}).waitFor();
 frame=await(await page.locator('.scanner-overlay iframe').elementHandle()).contentFrame();
 await frame.waitForFunction(()=>document.body.dataset.scanner==='ready'&&document.body.dataset.camera==='user');
 ok(await page.evaluate(()=>window.__emptyOldTracks.every(t=>t.readyState==='ended')),'Cambiar de cámara libera las pistas anteriores');
 ok(await iframe.locator('#onboarding').count()===0,'Cambiar de cámara conserva Entendido');
 await frame.evaluate(()=>{parent.__emptyClosingTracks=document.querySelector('#scene video').srcObject.getTracks();});
 await page.getByRole('button',{name:'Cerrar cámara'}).click();
 await page.waitForFunction(()=>window.__emptyClosingTracks.every(t=>t.readyState==='ended'));
 ok(true,'Cerrar la cámara detiene todas las pistas');
 ok(targets.length===0,'La galería vacía no descarga el motor ni referencias de reconocimiento');
 ok(errors.length===0,'Sin errores de JavaScript');
 await writeFile('output/empty-camera/results.json',JSON.stringify({passed:true,base,checks,date:new Date().toISOString()},null,2));
}finally{await browser.close();}
