import {readFile} from 'node:fs/promises';
const base='http://127.0.0.1:8788';const code=(await readFile('private/organizador.txt','utf8')).trim().split('\n').at(-1).trim();
const login=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({role:'admin',code})});if(!login.ok)throw Error(await login.text());const cookie=login.headers.get('set-cookie').split(';')[0];const data=await(await fetch(base+'/api/admin',{headers:{cookie}})).json();
for(const w of data.submissions.filter(w=>w.slot_id<=3)){const r=await fetch(base+'/api/admin/works/'+w.id,{method:'POST',headers:{Origin:base,cookie,'Content-Type':'application/json'},body:JSON.stringify({...w,status:'approved',active:true})});if(!r.ok)throw Error(await r.text());}
console.log('Tres entregas aprobadas por la API administrativa.');
