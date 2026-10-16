import {launch} from './browser.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const browser=await launch();
try{const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',e=>console.log('BROWSER ERROR',e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,300));});
 const base=process.env.BASE_URL||'http://127.0.0.1:8788';const code=(await readFile('private/organizador.txt','utf8')).trim().split('\n').at(-1).trim();
 await page.goto(base+'/#/organizador');await page.getByLabel('Código de acceso').fill(code);await page.getByRole('button',{name:'Entrar a mi espacio'}).click();await page.getByRole('heading',{name:'La colección, en tus manos.'}).waitFor();
 await page.getByRole('button',{name:'Preparar publicación'}).click();const compiler=page.frameLocator('dialog iframe');await compiler.getByRole('button',{name:'Compilar referencias'}).click();
 await compiler.locator('#result').waitFor({state:'visible',timeout:240000});console.log(await compiler.locator('#status').textContent());
 await compiler.getByRole('button',{name:'Publicar esta colección'}).click();await page.locator('dialog').waitFor({state:'detached',timeout:60000});await page.getByText('La colección se publicó correctamente.',{exact:true}).waitFor();
 const manifest=await(await page.request.get(base+'/api/gallery')).json();await mkdir('output',{recursive:true});await writeFile('output/manifest.json',JSON.stringify(manifest,null,2));console.log('Publicación real:',manifest.works.length,'obras,',manifest.groups.length,'grupo(s).');
 await page.goto(base);await page.getByRole('heading',{name:/Realidad aumentada/}).waitFor();await page.screenshot({path:'output/escritorio.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'output/movil.png',fullPage:true});
}finally{await browser.close();}

