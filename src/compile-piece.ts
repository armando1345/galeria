export function compilePiece(image:File,onProgress:(progress:number)=>void,signal:AbortSignal):Promise<Uint8Array>{
  return new Promise((resolve,reject)=>{
    const iframe=document.createElement('iframe');
    iframe.src='/publish.html';iframe.title='Preparando referencia de la pieza';iframe.setAttribute('aria-hidden','true');iframe.tabIndex=-1;
    // Keep the frame in the viewport: display:none/offscreen pauses the
    // requestAnimationFrame calls used by TensorFlow's image compiler.
    iframe.style.cssText='position:fixed;right:0;bottom:0;width:2px;height:2px;opacity:.001;pointer-events:none;border:0';
    const dispose=()=>{clearTimeout(timeout);window.removeEventListener('message',message);signal.removeEventListener('abort',abort);iframe.remove();};
    const abort=()=>{dispose();reject(new DOMException('Publicación cancelada','AbortError'));};
    const message=(event:MessageEvent)=>{
      if(event.origin!==location.origin||event.source!==iframe.contentWindow)return;
      if(event.data?.type==='piece-compiler-ready')iframe.contentWindow?.postMessage({type:'compile-piece',image},location.origin);
      else if(event.data?.type==='piece-progress')onProgress(Math.round(event.data.progress));
      else if(event.data?.type==='piece-compiled'){dispose();resolve(new Uint8Array(event.data.bytes));}
      else if(event.data?.type==='piece-error'){dispose();reject(Error(event.data.error||'No pudimos preparar esta imagen.'));}
    };
    const timeout=setTimeout(()=>{dispose();reject(Error('Preparar la imagen está tardando demasiado. Usa una imagen más pequeña e inténtalo de nuevo.'));},240000);
    window.addEventListener('message',message);signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted){abort();return;}
    document.body.append(iframe);
  });
}
