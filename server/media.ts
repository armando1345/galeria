import { Buffer } from 'node:buffer';

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function ensure(ok: unknown, message: string, status = 400): asserts ok { if (!ok) throw new HttpError(status, message); }
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc(b:Buffer,start:number,end:number){let c=0xffffffff;for(let i=start;i<end;i++)c=crcTable[(c^b[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;}
export function imageInfo(bytes: Uint8Array) {
  // Inspect container structure and metadata without allocating decoded pixels
  // in a 128 MB Worker. Actual image decoding also happens in the browser.
  const b = Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let width=0, height=0, mime='';
  const validDimensions=()=>ensure(width>=320&&height>=320&&width<=4096&&height<=4096&&width*height<=8000000,'Usa un PNG/JPG entre 320 y 4096 px por lado, hasta 8 megapíxeles.');
  if (b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    ensure(b.length>33&&b.toString('ascii',12,16)==='IHDR'&&b.readUInt32BE(8)===13,'PNG incompleto.'); width=b.readUInt32BE(16); height=b.readUInt32BE(20); mime='image/png';
    validDimensions();
    ensure(b[24]===8&&[0,2,3,4,6].includes(b[25])&&b[26]===0&&b[27]===0&&b[28]<=1,'Exporta un PNG estándar de 8 bits.');
    let p=8,idat=false,end=false,first=true;
    while(p<b.length){ensure(p+12<=b.length,'PNG incompleto.');const n=b.readUInt32BE(p);ensure(p+12+n<=b.length,'Bloque PNG inválido.');const type=b.toString('ascii',p+4,p+8);ensure(first||type!=='IHDR','Cabecera PNG duplicada.');ensure(crc(b,p+4,p+8+n)===b.readUInt32BE(p+8+n),'PNG dañado: comprobación CRC incorrecta.');if(type==='IDAT'){ensure(n>0,'PNG sin datos.');idat=true;}p+=12+n;first=false;if(type==='IEND'){ensure(n===0&&p===b.length,'Final PNG inválido.');end=true;break;}}
    ensure(idat&&end,'PNG incompleto.');
  } else if(b[0]===255 && b[1]===216) {
    let p=2,scan=false,ended=false;
    while(p<b.length){ensure(b[p]===255,'JPEG inválido.');while(b[p]===255)p++;ensure(p<b.length,'JPEG incompleto.');const tag=b[p++];if(tag===217){ensure(p===b.length,'JPEG con datos posteriores al final.');ended=true;break;}ensure(p+2<=b.length,'JPEG incompleto.');const n=b.readUInt16BE(p);ensure(n>=2&&p+n<=b.length,'JPEG incompleto.');if([192,193,194].includes(tag)){ensure(n>=8,'JPEG inválido.');height=b.readUInt16BE(p+3);width=b.readUInt16BE(p+5);}p+=n;if(tag===218){scan=true;while(p<b.length-1){if(b[p]!==255){p++;continue;}if(b[p+1]===0||(b[p+1]>=208&&b[p+1]<=215)){p+=2;continue;}break;}}}
    ensure(scan&&ended,'JPEG sin datos completos.');mime='image/jpeg';
  }
  ensure(width>=320 && height>=320 && width<=4096 && height<=4096 && width*height<=8000000,'Usa un PNG/JPG entre 320 y 4096 px por lado, hasta 8 megapíxeles.');
  return {width,height,mime};
}
type Box={type:string;start:number;end:number};
function boxes(b:Buffer,start=0,end=b.length):Box[] {const out:Box[]=[];let p=start;while(p<end){ensure(p+8<=end,'MP4 incompleto.');let n=b.readUInt32BE(p);const type=b.toString('ascii',p+4,p+8);let header=8;if(n===1){ensure(p+16<=end,'MP4 inválido.');n=Number(b.readBigUInt64BE(p+8));header=16;}if(n===0)n=end-p;ensure(n>=header && p+n<=end,'Estructura MP4 inválida.');out.push({type,start:p+header,end:p+n});p+=n;}return out;}
function child(b:Buffer,box:Box,type:string){const c=boxes(b,box.start,box.end).find(x=>x.type===type);ensure(c,`MP4 sin ${type}.`);return c;}
function duration(b:Buffer,box:Box) { const v=b[box.start];ensure(v===0||v===1,'Versión MP4 no compatible.');const p=box.start+(v===1?20:12);ensure(p+(v===1?12:8)<=box.end,'Duración inválida.');const timescale=b.readUInt32BE(p);const ticks=v===1?Number(b.readBigUInt64BE(p+4)):b.readUInt32BE(p+4);ensure(timescale>0,'Escala temporal inválida.');return ticks/timescale; }
export function videoInfo(bytes:Uint8Array) {
 const b=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength);const top=boxes(b);ensure(top.some(x=>x.type==='ftyp')&&top.some(x=>x.type==='mdat'),'Sube un MP4 completo.');const moov=top.find(x=>x.type==='moov');ensure(moov,'MP4 sin metadatos.');const movieDuration=duration(b,child(b,moov,'mvhd'));let result:{width:number;height:number;duration:number}|undefined;let videos=0;
 for(const trak of boxes(b,moov.start,moov.end).filter(x=>x.type==='trak')) {const mdia=child(b,trak,'mdia'), hdlr=child(b,mdia,'hdlr'); if(b.toString('ascii',hdlr.start+8,hdlr.start+12)!=='vide')continue;videos++;
 const tkhd=child(b,trak,'tkhd');const m=tkhd.start+(b[tkhd.start]===1?52:40);ensure(m+36<=tkhd.end,'Pista inválida.');ensure(b.readInt32BE(m)===65536&&b.readInt32BE(m+4)===0&&b.readInt32BE(m+12)===0&&b.readInt32BE(m+16)===65536,'Exporta el video sin metadatos de rotación.');
 const stsd=child(b,child(b,child(b,mdia,'minf'),'stbl'),'stsd');const entries=boxes(b,stsd.start+8,stsd.end);ensure(entries.length===1&&entries[0].type==='avc1','Exporta el MP4 con códec H.264 (avc1).');const entry=entries[0];ensure(entry.start+78<=entry.end,'Pista H.264 incompleta.');const width=b.readUInt16BE(entry.start+24),height=b.readUInt16BE(entry.start+26);ensure(boxes(b,entry.start+78,entry.end).some(x=>x.type==='avcC'),'Falta configuración H.264.');
 const d=duration(b,child(b,mdia,'mdhd')); ensure(d>0&&d<=15.05&&movieDuration>0&&movieDuration<=15.05,'El video debe durar como máximo 15 segundos.');ensure(width>=320&&height>=320&&width<=1920&&height<=1920,'Video: entre 320 y 1920 px por lado.');result={width,height,duration:Math.max(d,movieDuration)};
 } ensure(videos===1&&result,'El MP4 debe tener exactamente una pista de video.');return result;
}
export function validatePair(image:ReturnType<typeof imageInfo>,video:ReturnType<typeof videoInfo>){ensure(Math.abs(image.width/image.height-video.width/video.height)/(image.width/image.height)<0.01,'La ilustración y el video deben tener la misma proporción (tolerancia 1 %).');}
