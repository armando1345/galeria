import {compilePiece} from './compile-piece';
import './theme.css';
import {brand} from './config';
import type {Gallery,Submission,Work} from './types';
import QRCode from 'qrcode';
const root=document.querySelector<HTMLDivElement>('#app')!;
document.title=brand.name;
document.documentElement.style.setProperty('--accent',brand.color);document.documentElement.style.setProperty('--ink',brand.ink);document.documentElement.style.setProperty('--paper',brand.paper);
const esc=(x:unknown)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const arrow='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
const camera='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 5l2-2h4l2 2h4v15H4V5z"/><circle cx="12" cy="12" r="4"/></svg>';
let routeAbort=new AbortController();
async function api<T=any>(path:string,init:RequestInit={}):Promise<T>{let r:Response;try{r=await fetch('/api'+path,{...init,signal:init.signal??routeAbort.signal});}catch(e){if((e as Error).name==='AbortError')throw e;throw Error('No pudimos conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.');}let d:any;try{d=await r.json();}catch{throw Error('El servidor no respondió correctamente. Vuelve a intentarlo.');}if(!r.ok)throw Object.assign(Error(d.error||'Error de conexión.'),{status:r.status});return d;}
const post=(path:string,data:unknown)=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
function notice(message:string,error=false){let el=document.querySelector('#notice');if(!el){el=document.createElement('div');el.id='notice';el.setAttribute('role','status');document.body.append(el);}el.textContent=message;el.className=error?'notice error':'notice';setTimeout(()=>el?.remove(),7000);}
const header=(_active='')=>`<header class="header"><a class="wordmark" href="#/"><img class="brand-logo" src="${brand.logo}" alt="${brand.name}" width="458" height="199"></a><a class="collection-link" href="#/obras">Ver colección</a></header>`;
let cleanup=()=>{};let routeVersion=0;
function dialog(html:string){const d=document.createElement('dialog');d.className='modal';d.innerHTML=`<button class="icon close" aria-label="Cerrar">×</button>${html}`;document.body.append(d);d.showModal();const close=()=>{d.close();d.querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load();});d.remove();};d.querySelector('.close')!.addEventListener('click',close);d.addEventListener('cancel',e=>{e.preventDefault();close();});d.addEventListener('click',e=>{if(e.target===d)close();});return d;}
function playWork(w:Work){const d=dialog(`<span class="eyebrow">${w.demo?'MATERIAL DE DEMOSTRACIÓN':'COLECCIÓN'}</span><h2>${esc(w.title)}</h2><p>${esc(w.name)}</p><video controls autoplay muted playsinline preload="none" src="${esc(w.video)}" poster="${esc(w.image)}"></video><p class="hint">Vista alternativa · sin cámara. Puedes repetir el video con sus controles.</p>`);d.querySelector('video')!.play().catch(()=>{});}
function cards(works:Work[]){return works.map(w=>`<button class="work-card" data-work="${esc(w.id)}"><div class="work-image"><img src="${esc(w.image)}" alt="Ilustración ${esc(w.title)}" loading="lazy"><span class="play-icon">↗</span>${w.demo?'<span class="demo-label">DEMO</span>':''}</div><div class="work-meta"><span>${String(w.slot).padStart(2,'0')}</span><div><h3>${esc(w.title)}</h3><p>${esc(w.name)}</p></div>${arrow}</div></button>`).join('');}
function bindCards(works:Work[]){root.querySelectorAll<HTMLButtonElement>('[data-work]').forEach(b=>b.onclick=()=>playWork(works.find(w=>w.id===b.dataset.work)!));}
async function landing(all=false){
  if(!all){
    root.innerHTML=header()+`<main class="minimal-landing"><h1>Realidad aumentada<br><em>gratuita</em> con disparos<br>ilimitados</h1><p class="lead">Clica abajo y empieza a crear con realidad aumentada. <br>No requiere registros ni descargas</p><div class="landing-actions"><a class="button primary" href="#/estudiante">${camera} Crea tu obra ${arrow}</a><button class="button outline" id="view-ar">Ver obra con realidad aumentada ${arrow}</button></div></main>`;
    root.querySelector('#view-ar')!.addEventListener('click',()=>openScanner());
    return;
  }
  const g=await api<Gallery>('/gallery');
  root.innerHTML=header()+`<main class="collection-page"><h1>Imágenes y sus animaciones</h1><p class="lead">Aquí verás la colección de imágenes con sus respectivas animaciones</p><button class="button primary" id="collection-camera">${camera} Ver obra con realidad aumentada ${arrow}</button><div class="work-grid">${cards(g.works)}</div>${!g.works.length?'<p class="empty">La colección se está preparando. Vuelve pronto.</p>':''}</main>`;
  bindCards(g.works);
  root.querySelector('#collection-camera')!.addEventListener('click',()=>openScanner());
}
async function creator(edit=false){
  cleanup();cleanup=()=>{};
  const data=await post('/creator/session',{}),latest=data.submission as Submission|null;
  if(latest&&data.published&&!edit){
    root.innerHTML=header()+`<main class="creator-page published-piece"><span class="publication-check" aria-hidden="true">✓</span><h1>Pieza publicada<br>con éxito.</h1><p class="lead">Escanéala para ver el resultado.</p><button class="button primary" id="scan-published">${camera} Ver mi pieza con realidad aumentada ${arrow}</button><button class="text-link" id="replace-creation" ${data.closed?'disabled':''}>Cambiar archivos ↗</button></main>`;
    root.querySelector('#scan-published')!.addEventListener('click',()=>openScanner());
    root.querySelector('#replace-creation')!.addEventListener('click',()=>void creator(true));return;
  }
  root.innerHTML=header()+`<main class="creator-page"><h1>Crea tu obra</h1><p class="lead creator-intro">La imagen y el video deben tener la misma proporción</p><form id="simple-upload"><div class="upload-grid"><div class="upload-zone file-zone"><span class="upload-number">01</span><label for="creator-image">Sube tu imagen inicial</label><span>PNG o JPG · hasta 12 MB</span><div class="file-choice"><label class="file-select" for="creator-image">Seleccionar archivo</label><span id="image-ready" class="file-ready" role="status" aria-label="Imagen lista" hidden>✓</span></div><input class="file-input" id="creator-image" type="file" name="image" accept="image/png,image/jpeg" aria-label="Sube tu imagen inicial" required ${data.closed?'disabled':''}><img id="image-preview" alt="Vista previa de la imagen inicial" hidden></div><div class="upload-zone file-zone"><span class="upload-number">02</span><label for="creator-video">Sube tu video</label><span>MP4 · hasta 100 MB</span><div class="file-choice"><label class="file-select" for="creator-video">Seleccionar archivo</label><span id="video-ready" class="file-ready" role="status" aria-label="Video listo" hidden>✓</span></div><input class="file-input" id="creator-video" type="file" name="video" accept="video/mp4" aria-label="Sube tu video" required ${data.closed?'disabled':''}><video id="video-preview" controls muted playsinline preload="metadata" hidden></video></div></div><p class="hint">El video se ajusta a tu imagen con un recorte centrado, sin deformarse.</p><button class="button primary" type="submit" ${data.closed?'disabled':''}>Publicar ${arrow}</button><p class="form-message" role="status">${data.closed?'Las publicaciones están cerradas.':''}</p></form></main>`;
  const form=root.querySelector<HTMLFormElement>('#simple-upload')!,urls=new Map<string,string>();
  const button=form.querySelector<HTMLButtonElement>('button[type=submit]')!,message=form.querySelector('.form-message')!;
  cleanup=()=>{root.querySelectorAll('video').forEach(v=>v.pause());urls.forEach(URL.revokeObjectURL);};
  const imagePreview=form.querySelector<HTMLImageElement>('#image-preview')!,videoPreview=form.querySelector<HTMLVideoElement>('#video-preview')!;
  const updateFrame=()=>{if(imagePreview.naturalWidth&&imagePreview.naturalHeight&&!imagePreview.hidden){videoPreview.style.aspectRatio=`${imagePreview.naturalWidth} / ${imagePreview.naturalHeight}`;videoPreview.style.objectFit='cover';videoPreview.style.objectPosition='center';videoPreview.style.setProperty('--frame-ratio',String(imagePreview.naturalWidth/imagePreview.naturalHeight));videoPreview.classList.add('framed-video');}else{videoPreview.style.removeProperty('aspect-ratio');videoPreview.classList.remove('framed-video');}};
  imagePreview.onload=updateFrame;videoPreview.onloadedmetadata=updateFrame;
  for(const key of ['image','video'])form.querySelector<HTMLInputElement>(`[name=${key}]`)!.onchange=e=>{
    const input=e.target as HTMLInputElement,file=input.files?.[0],ready=form.querySelector<HTMLElement>(`#${key}-ready`)!;
    ready.hidden=true;message.textContent='';
    const preview=form.querySelector<HTMLImageElement|HTMLVideoElement>(`#${key}-preview`)!;
    const previous=urls.get(key);if(previous)URL.revokeObjectURL(previous);preview.removeAttribute('src');preview.hidden=true;if(key==='image'){videoPreview.style.removeProperty('aspect-ratio');videoPreview.classList.remove('framed-video');}
    if(!file)return;
    const limit=key==='image'?12:100;
    const maxBytes=key==='image'?12*1024*1024:100_000_000;
    if(file.size>maxBytes){input.value='';message.textContent=`El ${key==='image'?'archivo de imagen':'video'} supera ${limit} MB.`;return;}
    const url=URL.createObjectURL(file);urls.set(key,url);preview.src=url;preview.hidden=false;ready.hidden=false;
  };
  form.onsubmit=async e=>{
    e.preventDefault();button.disabled=true;message.textContent='';
    const image=form.querySelector<HTMLInputElement>('[name=image]')!.files![0],video=form.querySelector<HTMLInputElement>('[name=video]')!.files![0];
    form.querySelectorAll<HTMLInputElement>('input').forEach(input=>input.disabled=true);
    const label=(text:string)=>{button.textContent=text;};
    let ticket:string|undefined;
    try{
      label('Preparando imagen…');
      const reference=await compilePiece(image,progress=>label(`Preparando imagen… ${progress} %`),routeAbort.signal);
      ticket=(await post('/creator/uploads',{})).id;
      label('Subiendo imagen…');
      await api(`/creator/uploads/${ticket}/image`,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Upload-Size':String(image.size)},body:image});
      label('Subiendo video…');
      await api(`/creator/uploads/${ticket}/video`,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Upload-Size':String(video.size)},body:video});
      label('Publicando pieza…');
      const publish=()=>api(`/creator/uploads/${ticket}/publish`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:new Blob([reference as BlobPart])});
      try{await publish();}catch(error){const status=(error as Error&{status?:number}).status;if(routeAbort.signal.aborted||status&&status<500)throw error;await publish();}
      await route();
    }catch(e){
      if((e as Error).name==='AbortError')return;
      if(ticket){try{const state=await post('/creator/session',{});if(state.published&&state.submission?.id===ticket){await route();return;}}catch{}}
      message.textContent=(e as Error).message;button.disabled=false;button.innerHTML=`Publicar ${arrow}`;
      form.querySelectorAll<HTMLInputElement>('input').forEach(input=>input.disabled=false);
    }
  };
}
function openScanner(group:number|'all'='all'){
  if(document.querySelector('.scanner-overlay'))return;
  if(!window.isSecureContext){notice('La cámara necesita HTTPS o localhost. Abre la URL segura en tu celular.',true);return;}
  const trigger=document.activeElement as HTMLElement|null;
  const overlay=document.createElement('div');
  overlay.className='scanner-overlay';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','Ver obra con realidad aumentada');
  overlay.innerHTML=`<iframe title="Escáner de realidad aumentada" allow="camera; autoplay" src="/scanner.html?group=${group}"></iframe><button class="scanner-close" aria-label="Cerrar cámara" title="Cerrar cámara">×</button>`;
  document.body.append(overlay);document.body.style.overflow='hidden';root.inert=true;
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};
  const close=()=>{if(!overlay.isConnected)return;overlay.remove();document.body.style.overflow='';root.inert=false;window.removeEventListener('keydown',onKey);if(trigger?.isConnected)trigger.focus();};
  overlay.querySelector<HTMLButtonElement>('button')!.onclick=close;
  overlay.querySelector<HTMLButtonElement>('button')!.focus();
  window.addEventListener('keydown',onKey);
  const previousCleanup=cleanup;
  cleanup=()=>{close();previousCleanup();};
}
async function scanner(){const g=await api<Gallery>('/gallery');root.innerHTML=header()+`<main class="scanner-intro"><span class="eyebrow">LA EXPERIENCIA / WEBAR</span><h1>Abre una<br>nueva dimensión.</h1><p class="lead">Coloca una ilustración frente a la cámara.<br>La animación aparecerá sobre el papel.</p>${g.groups.length>1?`<label>Grupo de obras<select id="scan-group">${g.groups.map((gr,i)=>`<option value="${i}">Grupo ${i+1} · espacios ${gr.ids.map(id=>g.works.find(w=>w.id===id)?.slot).join(', ')}</option>`).join('')}</select></label>`:''}<button class="button primary" id="open-camera" ${!g.groups.length?'disabled':''}>${camera} Activar mi cámara ${arrow}</button><p class="hint">La cámara se procesa en tu dispositivo.<br>No grabamos ni subimos imágenes. Videos inicialmente sin sonido.</p><a class="text-link" href="#/obras">Prefiero ver las animaciones sin cámara ↗</a><div class="camera-tips"><span>01 / Buena iluminación</span><span>02 / Papel completo a la vista</span><span>03 / Evita reflejos</span></div>${!g.groups.length?'<p class="form-message">Todavía no hay referencias publicadas.</p>':''}</main>`;root.querySelector('#open-camera')!.addEventListener('click',()=>openScanner(Number(root.querySelector<HTMLSelectElement>('#scan-group')?.value||0)));}
async function tests(){const g=await api<Gallery>('/gallery');root.innerHTML=header()+`<main class="workspace"><span class="eyebrow">PRUEBA LA EXPERIENCIA</span><div class="section-heading"><div><h1>El punto de partida.</h1><p class="lead">Imprime estas ilustraciones o ábrelas en otra pantalla.<br>Después, escanéalas desde tu celular.</p></div><button class="button outline" id="print">Imprimir referencias ↗</button></div><div class="test-info"><p>Imprime en color, sin recortar ni deformar. Usa papel mate y evita reflejos. Empieza a unos 30–50 cm. Los tres ejemplos son material de demostración.</p><a class="button primary" href="#/escaner">${camera} Abrir escáner ${arrow}</a></div><div class="work-grid print-grid">${g.works.map(w=>`<article class="print-card"><span class="eyebrow">ESPACIO ${String(w.slot).padStart(2,'0')} ${w.demo?'· DEMO':''}</span><img src="${w.image}" alt="Referencia ${esc(w.title)}"><h3>${esc(w.title)}</h3><a class="text-link" href="${w.image}" target="_blank" rel="noopener">Abrir imagen completa ↗</a></article>`).join('')}</div><section class="qr-panel"><div><span class="eyebrow">UN SOLO ACCESO PARA TODA LA GALERÍA</span><h2>Escanea. Descubre.</h2><label>URL pública HTTPS de la galería<input id="qr-url" type="url" value="${esc(location.origin+'/')}" placeholder="https://tu-galeria.pages.dev"></label><button id="make-qr" class="button outline">Generar QR</button><p id="qr-note" class="hint">Para celulares, usa una dirección HTTPS accesible. localhost solo funciona en este equipo.</p></div><div><canvas id="qr"></canvas><a id="download-qr" class="text-link" download="galeria-entre-fases-qr.png">Descargar QR ↗</a></div></section></main>`;root.querySelector('#print')!.addEventListener('click',()=>window.print());const qr=async()=>{const input=root.querySelector<HTMLInputElement>('#qr-url')!;try{const url=new URL(input.value);if(!['https:','http:'].includes(url.protocol))throw Error('Usa una URL HTTP o HTTPS.');const canvas=root.querySelector<HTMLCanvasElement>('#qr')!;await QRCode.toCanvas(canvas,url.href,{width:220,margin:2,color:{dark:brand.ink,light:brand.paper}});root.querySelector<HTMLAnchorElement>('#download-qr')!.href=canvas.toDataURL();root.querySelector('#qr-note')!.textContent=url.protocol!=='https:'?'Este QR es local. Para probar en un celular, genera otro con la URL HTTPS pública.':'QR generado para '+url.hostname+'. Comprueba que la dirección sea accesible desde el celular.';}catch(e){notice((e as Error).message,true);}};root.querySelector('#make-qr')!.addEventListener('click',qr);await qr();}
async function route(){const version=++routeVersion;routeAbort.abort();routeAbort=new AbortController();cleanup();cleanup=()=>{};document.querySelectorAll('dialog').forEach(d=>d.remove());root.innerHTML=header()+`<main class="loading"><span class="spinner"></span><p>Preparando la experiencia…</p></main>`;window.scrollTo({top:0,left:0,behavior:'instant'});try{const path=location.hash.replace(/^#\/?/,'').split('?')[0];if(path==='estudiante'||path==='crear')await creator();else if(path==='acceso-estudiante')await creator();else if(path==='organizador'){history.replaceState(null,'','#/');await landing();}else if(path==='escaner')await scanner();else if(path==='pruebas')await tests();else await landing(path==='obras');}catch(e){if(version!==routeVersion)return;root.innerHTML=header()+`<main class="access"><span class="eyebrow">NO PUDIMOS CONECTAR</span><h1>Un momento<br>entre dimensiones.</h1><p>${esc((e as Error).message)}</p><button class="button primary" id="retry">Volver a intentar ${arrow}</button></main>`;root.querySelector('#retry')!.addEventListener('click',()=>void route());}}
window.addEventListener('hashchange',()=>void route());window.addEventListener('pagehide',()=>cleanup());void route();

