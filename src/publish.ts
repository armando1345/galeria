// Isolated compiler: removing this iframe releases its worker and WebGL state.
window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='compile-piece')return;
  let objectUrl:string|undefined;
  try{
    const file=event.data.image as File;
    objectUrl=URL.createObjectURL(file);
    const image=new Image();image.src=objectUrl;await image.decode();
    const scale=Math.min(1,1024/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
    canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);
    const normalized=new Image();normalized.src=canvas.toDataURL('image/png');await normalized.decode();
    const {Compiler}=await import(/* @vite-ignore */ '/vendor/mindar-image.prod.js');
    const compiler=new Compiler();
    await compiler.compileImageTargets([normalized],(progress:number)=>parent.postMessage({type:'piece-progress',progress},location.origin));
    if(!compiler.data?.[0]?.matchingData?.some((frame:any)=>(frame.maximaPoints?.length||0)+(frame.minimaPoints?.length||0)>=20))throw Error('La imagen tiene muy pocos detalles para reconocerla. Usa una ilustración con más contraste.');
    const bytes=compiler.exportData() as Uint8Array;
    parent.postMessage({type:'piece-compiled',bytes},location.origin);
  }catch(error){const message=error instanceof Error&&error.message.startsWith('La imagen')?error.message:'No pudimos preparar la imagen. Selecciona un PNG o JPG válido con detalles y contraste.';parent.postMessage({type:'piece-error',error:message},location.origin);}
  finally{if(objectUrl)URL.revokeObjectURL(objectUrl);}
});
parent.postMessage({type:'piece-compiler-ready'},location.origin);
