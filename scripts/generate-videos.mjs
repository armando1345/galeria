import ffmpeg from 'ffmpeg-static';
import {execFileSync} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
await mkdir('demo/videos',{recursive:true});
for(let i=1;i<=3;i++){const n=String(i).padStart(2,'0');execFileSync(ffmpeg,['-y','-i',`public/demo/${n}.png`,'-vf',`zoompan=z='1+0.055*sin(on/143*PI/2)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=144:s=640x800:fps=24,format=yuv420p`,'-t','6','-c:v','libx264','-profile:v','main','-crf','23','-movflags','+faststart','-an',`demo/videos/${n}.mp4`],{stdio:'pipe'});console.log(`Video ${n}: 6 s, H.264, sin audio.`);}

