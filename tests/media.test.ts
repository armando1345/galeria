import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {imageInfo,videoInfo,validatePair} from '../server/media';
const image=readFileSync('public/demo/01.png'),video=readFileSync('demo/videos/01.mp4');
test('PNG real se valida en servidor con dimensiones y CRC correctos',()=>{const m=imageInfo(image);assert.equal(m.width,640);assert.equal(m.height,800);assert.equal(m.mime,'image/png');});
test('JPEG real se valida en servidor',()=>{const m=imageInfo(readFileSync('tests/fixtures/valid.jpg'));assert.equal(m.width,640);assert.equal(m.height,800);assert.equal(m.mime,'image/jpeg');});
test('JPEG truncado se rechaza',()=>assert.throws(()=>imageInfo(readFileSync('tests/fixtures/valid.jpg').subarray(0,300))));
test('MP4 real H.264 devuelve dimensiones y duración',()=>{const m=videoInfo(video);assert.equal(m.width,640);assert.equal(m.height,800);assert.equal(m.duration,6);});
test('Los tres pares de demostración cumplen proporciones y duración',()=>{for(const n of ['01','02','03'])validatePair(imageInfo(readFileSync(`public/demo/${n}.png`)),videoInfo(readFileSync(`demo/videos/${n}.mp4`)));});
test('Rechaza imagen corrupta y archivo disfrazado de PNG',()=>{assert.throws(()=>imageInfo(Buffer.from('<svg onload="alert(1)">')));const bad=Buffer.from(image);bad[bad.length-30]^=255;assert.throws(()=>imageInfo(bad));});
test('Rechaza dimensiones exageradas antes de descomprimir',()=>{const bad=Buffer.from(image);bad.writeUInt32BE(65000,16);assert.throws(()=>imageInfo(bad),/4096/);});
test('Rechaza MP4 truncado y texto con extensión MP4',()=>{assert.throws(()=>videoInfo(video.subarray(0,100)));assert.throws(()=>videoInfo(Buffer.from('esto no es video')));});
test('Rechaza videos superiores a 15 s con validación de metadatos',()=>{const bad=Buffer.from(video);const i=bad.indexOf(Buffer.from('mvhd'));assert.ok(i>0);bad.writeUInt32BE(20000,i+20);assert.throws(()=>videoInfo(bad),/15 segundos/);});
test('Rechaza códec no H.264',()=>{const bad=Buffer.from(video);const i=bad.indexOf(Buffer.from('avc1'),40);assert.ok(i>0);bad.write('hvc1',i);assert.throws(()=>videoInfo(bad),/H.264/);});
test('Rechaza ilustración y video con proporciones diferentes',()=>{assert.throws(()=>validatePair({width:800,height:800,mime:'image/png'},{width:640,height:800,duration:6}),/proporción/);});

