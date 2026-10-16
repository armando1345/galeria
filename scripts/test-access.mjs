import {launch} from './browser.mjs';
import {testPin} from './access.mjs';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:8790';
assert.equal(new URL(base).hostname,'127.0.0.1','La publicación de prueba requiere una base local aislada');
const pin=await testPin(),checks=[];const ok=(v,m)=>{assert.ok(v,m);checks.push(m);console.log('✓',m);};
await mkdir('output/pin-access',{recursive:true});
const browser=await launch(['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-video-capture=${resolve('output/autopublish/camera.y4m')}`]);
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['obras','estudiante','crear','acceso-estudiante','pruebas']){
  await page.goto(base+'/#/'+route);await page.getByLabel('PIN de acceso',{exact:true}).waitFor();
  assert.equal(await page.locator('input').count(),1);assert.equal(await page.locator('input[type=file],.pair-card').count(),0);
 }
 ok(true,'Todas las entradas a colección y creación piden un único campo de PIN');
 await page.goto(base+'/#/obras');await page.getByLabel('PIN de acceso',{exact:true}).fill(pin==='0000'?'0001':'0000');
 await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByText('PIN incorrecto',{exact:true}).waitFor();
 ok(await page.locator('.collection-page').count()===0,'Un PIN incorrecto no muestra la colección');
 for(const width of [320,390,1366]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`output/pin-access/form-${width}.png`,fullPage:true});}
 await page.getByLabel('PIN de acceso',{exact:true}).fill(pin);await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await page.getByText('Aún no hay contenido publicado',{exact:true}).waitFor();ok(true,'El PIN correcto abre la colección');
 await page.goto(base+'/#/estudiante');await page.getByRole('button',{name:'Publicar',exact:true}).waitFor();
 ok(await page.locator('input[type=file]').count()===2,'La misma sesión abre el formulario de publicación');
 await page.getByLabel('Sube tu imagen inicial',{exact:true}).setInputFiles('tests/fixtures/publication.png');
 await page.getByLabel('Sube tu video',{exact:true}).setInputFiles('tests/fixtures/publication.mp4');
 await page.getByRole('button',{name:'Publicar',exact:true}).click();await page.getByRole('heading',{name:'Pieza publicada con éxito.'}).waitFor({timeout:180000});
 const state=await(await page.request.post(base+'/api/creator/session',{headers:{Origin:base},data:{}})).json(),id=state.submission.id;
 ok(state.published,'Publicación real permitida después del PIN');
 const guest=await browser.newContext({permissions:['camera'],viewport:{width:390,height:844}}),guestPage=await guest.newPage();
 for(const [path,method]of [['/gallery','get'],['/creator/session','post'],['/creator/uploads','post'],[`/collection/works/${id}/delete`,'post'],[`/media/${id}/image`,'get']]){
  const response=await guest.request[method](base+'/api'+path,{headers:{Origin:base},...(method==='post'?{data:{}}:{})});assert.equal(response.status(),401,path);
 }
 ok(true,'Sin PIN tampoco se puede consultar, publicar, borrar ni cargar imágenes directamente por API');
 const creatorCookie=(await context.cookies(base+'/api')).find(c=>c.name==='umbral_creator');
 const bypass=await guest.request.post(base+'/api/creator/session',{headers:{Origin:base,Cookie:`umbral_creator=${creatorCookie.value}`},data:{}});
 ok(bypass.status()===401,'Una cookie de creador previa no permite saltarse el PIN');
 const scan=await(await guest.request.get(base+'/api/scan')).json();
 ok(!('image' in scan.works[0])&&!('title' in scan.works[0]),'El catálogo público del escáner no incluye imágenes ni títulos');
 await guestPage.goto(base);await guestPage.getByRole('button',{name:'Ver obra con realidad aumentada',exact:true}).click();
 await guestPage.frameLocator('.scanner-overlay iframe').getByRole('button',{name:'Entendido',exact:true}).click();
 const frame=await(await guestPage.locator('.scanner-overlay iframe').elementHandle()).contentFrame();
 await frame.waitForFunction(id=>document.body.dataset.activeWork===id&&[...document.querySelectorAll('video')].some(v=>v.getAttribute('src')===`/api/media/${id}/video`&&!v.paused&&v.currentTime>.1),id,{timeout:90000});
 ok(true,'Sin PIN, la cámara sigue reconociendo la pieza y reproduciendo su video');
 await guestPage.getByRole('button',{name:'Cerrar cámara'}).click();await guest.close();
 await page.getByRole('link',{name:'Ver colección',exact:true}).click();await page.locator('.pair-card').waitFor();
 await page.getByRole('button',{name:'Borrar pareja 1',exact:true}).click();await page.getByRole('button',{name:'Borrar imagen y video',exact:true}).click();
 await page.getByText('Aún no hay contenido publicado',{exact:true}).waitFor();ok(true,'La colección autorizada mantiene el borrado de parejas y termina vacía');
 ok(errors.length===0,'Sin errores de JavaScript');
 await writeFile('output/pin-access/results.json',JSON.stringify({passed:true,checks,date:new Date().toISOString()},null,2));
}finally{await browser.close();}
