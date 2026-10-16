import {videoFrame} from './video-frame';
import {decode,encode} from '@msgpack/msgpack';
import './scanner.css';
import type {Gallery,Work} from './types';
import {brand} from './config';
document.title=brand.name+' · Escáner';
document.querySelector<HTMLImageElement>('.scan-brand img')!.alt=brand.name;
const params=new URLSearchParams(location.search),facing=params.get('camera')==='user'?'user':'environment';
const onboarding=document.querySelector<HTMLDivElement>('#onboarding')!,replay=document.querySelector<HTMLButtonElement>('#replay')!,retry=document.querySelector<HTMLButtonElement>('#retry-play')!,switchCamera=document.querySelector<HTMLButtonElement>('#switch-camera')!,errorPanel=document.querySelector<HTMLDivElement>('#scan-error')!;
let acknowledged=params.get('ready')==='1';
if(acknowledged)onboarding.remove();
document.querySelector('#understood')?.addEventListener('click',()=>{acknowledged=true;onboarding.remove();});
switchCamera.setAttribute('aria-label',facing==='user'?'Usar cámara trasera':'Usar cámara frontal');switchCamera.title=switchCamera.getAttribute('aria-label')!;
switchCamera.onclick=()=>{const url=new URL(location.href);url.searchParams.set('camera',facing==='user'?'environment':'user');url.searchParams.set('ready',acknowledged?'1':'0');stop();location.replace(url.href);};
let engine:any,alive=true,active:string|null=null,epoch=0,targetUrl:string|undefined;
const assets=new Map<string,{video:HTMLVideoElement;texture:any;material:any;geometry:any;mesh:any}>();
function stop(){if(targetUrl){URL.revokeObjectURL(targetUrl);targetUrl=undefined;}alive=false;epoch++;active=null;delete document.body.dataset.activeWork;for(const {video,texture,material,geometry}of assets.values()){video.pause();video.removeAttribute('src');video.load();video.remove();texture.dispose();material.dispose();geometry.dispose();}assets.clear();try{engine?.controller?.stopProcessVideo();engine?.controller?.worker?.terminate();}catch{}const el=document.querySelector('#scene')!;el.querySelectorAll('video').forEach(v=>{(v.srcObject as MediaStream|null)?.getTracks().forEach(t=>t.stop());v.srcObject=null;});try{engine?.renderer?.setAnimationLoop(null);engine?.renderer?.dispose();engine?.renderer?.forceContextLoss();}catch{}el.replaceChildren();}
function showError(message:string){onboarding.remove();errorPanel.hidden=false;document.querySelector('#error-message')!.textContent=message;}
async function start(){try{
 if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('La cámara necesita una dirección HTTPS y un navegador compatible.');
 const response=await fetch('/api/gallery');if(!response.ok)throw Error('No se pudo cargar la colección.');
 const gallery:Gallery=await response.json(),selection=params.get('group')||'all';
 const groups=selection==='all'?gallery.groups:[gallery.groups[Number(selection)]].filter(Boolean);
 if(!groups.length)throw Error('No hay referencias publicadas para este grupo.');
 let imageTargetSrc:string;const targetIds:string[]=[];
 if(groups.length===1&&!groups[0].sourceIds){imageTargetSrc=groups[0].target;targetIds.push(...groups[0].ids);}
 else{
   const dataList:any[]=[];
   for(const group of groups){const file=await fetch(group.target);if(!file.ok)throw Error('No se pudo cargar la referencia de una pieza.');const reference=decode(new Uint8Array(await file.arrayBuffer())) as any;const sourceIds=group.sourceIds||group.ids;
     if(reference.v!==2||reference.dataList?.length!==sourceIds.length)throw Error('Una referencia de reconocimiento está incompleta.');
     for(const id of group.ids){if(targetIds.includes(id))continue;const index=sourceIds.indexOf(id);if(index<0||!gallery.works.some(w=>w.id===id))continue;dataList.push(reference.dataList[index]);targetIds.push(id);}
   }
   if(!dataList.length)throw Error('Todavía no hay piezas para reconocer.');
   const bytes=encode({v:2,dataList});targetUrl=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/octet-stream'}));imageTargetSrc=targetUrl;
 }
 const [THREE,{MindARThree}]=await Promise.all([import(/* @vite-ignore */ '/vendor/three.module.js'),import(/* @vite-ignore */ '/vendor/mindar-image-three.prod.js')]);if(!alive)return;
 engine=new MindARThree({container:document.querySelector('#scene'),imageTargetSrc,maxTrack:1,uiLoading:'no',uiScanning:'no',uiError:'no',filterMinCF:.001,filterBeta:.01,warmupTolerance:3,missTolerance:7});engine.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 // Keep native permission errors and stop streams granted after teardown.
 engine._startVideo=async()=>{const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing}}});if(!alive){stream.getTracks().forEach(t=>t.stop());throw Error('La cámara se cerró.');}const video=document.createElement('video');video.autoplay=true;video.muted=true;video.playsInline=true;engine.video=video;document.querySelector('#scene')!.append(video);await new Promise<void>((resolve,reject)=>{video.onloadedmetadata=()=>{video.width=video.videoWidth;video.height=video.videoHeight;resolve();};video.onerror=()=>reject(Error('No se pudo leer la cámara.'));video.srcObject=stream;});switchCamera.disabled=false;document.body.dataset.camera=facing;};
 const play=async(w:Work)=>{if(!alive)return;const seq=++epoch;for(const [id,a]of assets){if(id!==w.id){a.video.pause();a.mesh.visible=false;}}active=w.id;document.body.dataset.activeWork=w.id;replay.hidden=true;retry.hidden=true;const a=assets.get(w.id)!;a.mesh.visible=false;if(!a.video.getAttribute('src')){a.video.src=w.video;a.video.load();}try{await a.video.play();if(!alive||seq!==epoch){a.video.pause();return;}a.mesh.visible=true;retry.hidden=true;}catch{if(seq!==epoch||!alive)return;retry.hidden=false;retry.onclick=()=>void play(w);}};
 for(let i=0;i<targetIds.length;i++){const w=gallery.works.find(x=>x.id===targetIds[i])!,anchor=engine.addAnchor(i),video=document.createElement('video');video.muted=true;video.defaultMuted=true;video.playsInline=true;video.loop=false;video.preload='none';video.setAttribute('playsinline','');video.setAttribute('muted','');video.style.display='none';document.body.append(video);const texture=new THREE.VideoTexture(video);texture.colorSpace=THREE.SRGBColorSpace;video.onloadedmetadata=()=>{const frame=videoFrame(w.width,w.height,video.videoWidth,video.videoHeight);texture.repeat.set(frame.x,frame.y);texture.offset.set(frame.offsetX,frame.offsetY);};const geometry=new THREE.PlaneGeometry(1,w.height/w.width),material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false}),mesh=new THREE.Mesh(geometry,material);mesh.position.z=.001;anchor.group.add(mesh);assets.set(w.id,{video,texture,geometry,material,mesh});anchor.onTargetFound=()=>void play(w);anchor.onTargetLost=()=>{if(active===w.id){epoch++;video.pause();active=null;delete document.body.dataset.activeWork;replay.hidden=true;retry.hidden=true;}};video.onended=()=>{if(active===w.id)replay.hidden=false;};}
 replay.onclick=()=>{if(!active)return;const a=assets.get(active)!;a.video.currentTime=0;replay.hidden=true;a.video.play().catch(()=>{retry.hidden=false;});};
 let timeout:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([engine.start(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('La cámara tardó demasiado. Comprueba los permisos y la conexión.')),45000);})]);}finally{clearTimeout(timeout);}if(!alive){stop();return;}engine.renderer.setAnimationLoop(()=>{if(alive)engine.renderer.render(engine.scene,engine.camera);});document.body.dataset.scanner='ready';
 }catch(e){stop();switchCamera.disabled=false;const messages:Record<string,string>={NotAllowedError:'Autoriza la cámara en los ajustes de este sitio y vuelve a intentarlo.',NotFoundError:'No encontramos esa cámara en este dispositivo. Puedes probar con la otra.',NotReadableError:'La cámara está ocupada. Cierra otras aplicaciones que la estén usando.'};showError(e instanceof Error?(messages[e.name]||e.message):'No pudimos iniciar la cámara. Comprueba los permisos y vuelve a intentar.');}
}
document.querySelector('#restart')!.addEventListener('click',()=>location.reload());window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();showError('La cámara se detuvo al salir de la experiencia.');}});void start();
