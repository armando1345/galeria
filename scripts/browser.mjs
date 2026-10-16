import {chromium} from 'playwright';
import {readdir,access} from 'node:fs/promises';
import path from 'node:path';
export async function launch(args=[]){
 let executablePath=process.env.CHROME_PATH;
 if(!executablePath&&process.env.LOCALAPPDATA){const base=path.join(process.env.LOCALAPPDATA,'ms-playwright');for(const d of (await readdir(base).catch(()=>[])).filter(d=>d.startsWith('chromium-')).reverse()){const p=path.join(base,d,'chrome-win64','chrome.exe');try{await access(p);executablePath=p;break;}catch{}}}
 return chromium.launch({executablePath,headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',...args]});
}
