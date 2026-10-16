import {test} from 'node:test';
import assert from 'node:assert/strict';
import {videoFrame} from '../src/video-frame';

test('El encuadre conserva el video completo si coincide con la imagen',()=>{
  assert.deepEqual(videoFrame(640,800,1280,1600),{x:1,y:1,offsetX:0,offsetY:0});
});
test('El recorte centrado llena imágenes horizontales y verticales sin deformación',()=>{
  for(const [iw,ih,vw,vh]of [[1920,1080,1920,1100],[640,800,1920,1080],[1920,1080,640,800]]){
    const f=videoFrame(iw,ih,vw,vh);
    assert.ok(Math.abs(vw*f.x/(vh*f.y)-iw/ih)<1e-10,'La región visible conserva la proporción original de los píxeles');
    assert.ok(f.x===1||f.y===1,'Aprovecha al menos una dimensión completa');
    assert.equal(f.offsetX+f.x/2,.5);assert.equal(f.offsetY+f.y/2,.5);
  }
});
