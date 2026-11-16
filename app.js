pdfjsLib.GlobalWorkerOptions.workerSrc='pdf.worker.min.js';
const ST={"ANDAMAN AND NICOBAR":35,"ANDHRA PRADESH":37,"ARUNACHAL PRADESH":12,"ASSAM":18,"BIHAR":10,"CHANDIGARH":4,"CHHATTISGARH":22,"DADRA AND NAGAR HAVELI":26,"DAMAN AND DIU":25,"DELHI":7,"GOA":30,"GUJARAT":24,"HARYANA":6,"HIMACHAL PRADESH":2,"JAMMU AND KASHMIR":1,"JHARKHAND":20,"KARNATAKA":29,"KERALA":32,"LAKSHADWEEP":31,"MADHYA PRADESH":23,"MAHARASHTRA":27,"MANIPUR":14,"MEGHALAYA":17,"MIZORAM":15,"NAGALAND":13,"ORISSA":21,"PONDICHERRY":34,"PUNJAB":3,"RAJASTHAN":8,"SIKKIM":11,"TAMIL NADU":33,"TELANGANA":36,"TRIPURA":16,"UTTAR PRADESH":9,"UTTARAKHAND":5,"WEST BENGAL":19};
function mkLines(items){
  const m=items.filter(i=>i.s.trim()!=='').sort((a,b)=>b.y-a.y||a.x-b.x),L=[];
  for(const it of m){const l=L.find(l=>Math.abs(l.y-it.y)<2);l?l.it.push(it):L.push({y:it.y,it:[it]});}
  L.forEach(l=>{l.it.sort((a,b)=>a.x-b.x);l.t=l.it.map(i=>i.s.trim()).join(' ');});
  return L;
}
function region(items,x0,x1,yTop,yBot){
  const sel=items.filter(i=>i.x>=x0&&i.x<x1&&i.y<=yTop&&i.y>yBot);
  return mkLines(sel).map(l=>l.t).reduce((a,t)=>a===''?t:(a.endsWith('-')?a+t:a+' '+t),'');
}
function labelY(items,s){const i=items.find(i=>i.s.trim().startsWith(s));return i?i.y:null;}
const clean=s=>(s||'').replace(/[^A-Za-z0-9 @#\-\/,&.]/g,' ').replace(/\s+/g,' ').trim();
function parseBOE(pages){
  const p1=pages[0]||[];
  const text=pages.map(p=>mkLines(p).map(l=>l.t).join('\n')).join('\n');
  const t1=mkLines(p1).map(l=>l.t).join('\n');
  if(!/Courier Bill Of Entry/i.test(t1)) throw new Error('Ye Courier Bill of Entry (CBE-XIII) nahi lag raha');
  const o={};
  // CBE number (wraps over 2 lines)
  const ci=p1.find(i=>/^CBEXIII/.test(i.s.trim()));
  if(ci){let s=ci.s.trim();const nx=p1.find(i=>Math.abs(i.x-ci.x)<2&&i.y<ci.y&&ci.y-i.y<14&&i.s.trim());if(nx)s+=nx.s.trim();o.cbe=s;}
  o.hawb=(t1.match(/HAWB Number\s*:\s*(\S+)/)||[])[1]||'';
  const oc=t1.match(/OOC ISSUED on (\d\d)-(\d\d)-(\d{4})/);
  const ch=text.match(/(\d\d\/\d\d\/\d{4})\s*$/m);
  o.date=oc?`${oc[1]}/${oc[2]}/${oc[3]}`:(ch?ch[1]:'');
  o.country=(t1.match(/Country of Exportation\s*:\s*([A-Z ]+?)(?:\n|$)/)||[])[1]||'';
  o.gstin=(t1.match(/KYC ID\s*:\s*(\w{15})/)||[])[1]||'';
  o.stateCode=+((t1.match(/State Code\s*:\s*(\d+)/)||[])[1]||0);
  const h=t1.match(/Assessable Value\s*:\s*([\d.]+)\s+Duty\s*\(Rs\.\)\s*:\s*([\d.]+)/);
  o.assessable=h?+h[1]:NaN;o.duty=h?+h[2]:NaN;
  const yA=labelY(p1,'Name of Consignor'),yB=labelY(p1,'Name of Consignee'),yC=labelY(p1,'Import Export Code');
  o.fromName=clean(region(p1,160,300,yA+1,yB+2));
  let fa=region(p1,415,700,yA+1,yB+2).replace(/\s*\d{4,6}$/,'');
  o.fromAddr=clean(fa);o.fromPlace=clean(o.country)||'HONG KONG';
  o.toName=clean(region(p1,160,300,yB+1,yC+2));
  let ta=region(p1,415,700,yB+1,yC+2);
  o.toPin=(ta.match(/(\d{6})\s*$/)||[])[1]||'';ta=ta.replace(/\s*\d{6}\s*$/,'');
  let place='';
  const sm=ta.match(new RegExp('(.*?)('+Object.keys(ST).map(s=>s.replace(/ /g,' ?')).join('|')+')\\s*INDIA\\s*$','i'));
  if(sm){ta=sm[1];const pm=ta.match(/([A-Z]+(?: [A-Z]+)*)$/);if(pm){place=pm[1];ta=ta.slice(0,pm.index);}}
  o.toPlace=clean(place);o.toAddr=clean(ta);
  // items
  o.items=[];
  const blocks=text.split(/^ITEM :/m).slice(1);
  for(const b of blocks){
    const g=r=>(b.match(r)||[])[1];
    const d={};
    for(const m of b.matchAll(/^\s*\d\s+(BCD|AIDC|SW Srchrg|IGST|CMPNSTRY)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*$/gm))d[m[1]]=[+m[2],+m[5]];
    const z=k=>d[k]||[0,0];
    o.items.push({hsn:g(/CTSH\s*:\s*(\d+)/),desc:clean(g(/Description of Goods\s*:\s*(.*)/)),qty:+g(/Quantity\s*:\s*([\d.]+)/),
      unit:g(/Unit of Measure\s*:\s*(\w+)/),av:+g(/Assessable Value\s*:\s*([\d.]+)/),rate:z('IGST')[0],igst:z('IGST')[1],
      oth:z('BCD')[1]+z('SW Srchrg')[1]+z('AIDC')[1],cess:z('CMPNSTRY')[1]});
  }
  return o;
}

const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let S={disp:'DELHI',dist:20,tid:'',tname:'',veh:'',src:'hawb',gstin:''},bills=[];
try{Object.assign(S,JSON.parse(localStorage.getItem('ewb_set')||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem('ewb_set',JSON.stringify(S))}catch(e){}};
const prof=g=>{try{return JSON.parse(localStorage.getItem('ewb_p_'+g)||'null')}catch(e){return null}};
const saveProf=b=>{try{localStorage.setItem('ewb_p_'+b.gstin,JSON.stringify({toName:b.toName,toAddr:b.toAddr,toPlace:b.toPlace,toPin:b.toPin}))}catch(e){}};
const r2=n=>Math.round(n*100)/100;
function build(b){
  const ig=r2(b.items.reduce((a,i)=>a+i.igst,0)),tv=r2(b.items.reduce((a,i)=>a+i.av,0));
  const duty=isNaN(b.duty)?b.items.reduce((a,i)=>a+i.igst+i.oth+i.cess,0):b.duty;
  const dc=ST[S.disp]||7,sc=b.stateCode||+b.gstin.slice(0,2);
  const j={userGstin:S.gstin||b.gstin,supplyType:'I',subSupplyType:2,subSupplyDesc:'',docType:'BOE',docNo:b.docNo,docDate:b.date,
   fromGstin:'URP',fromTrdName:b.fromName,fromAddr1:b.fromAddr.slice(0,120),fromAddr2:b.fromAddr.slice(120,240),fromPlace:b.fromPlace,fromPincode:999999,actFromStateCode:dc,fromStateCode:99,
   toGstin:b.gstin,toTrdName:b.toName,toAddr1:b.toAddr.slice(0,120),toAddr2:b.toAddr.slice(120,240),toPlace:b.toPlace,toPincode:+b.toPin,actToStateCode:sc,toStateCode:sc,
   transactionType:1,otherValue:r2(duty-ig),totalValue:tv,cgstValue:0,sgstValue:0,igstValue:ig,cessValue:0,cessNonAdvolValue:0,totInvValue:Math.round(tv+duty),
   transDistance:String(S.dist||0)};
  if(S.veh){j.transMode=1;j.vehicleNo=S.veh.toUpperCase().replace(/[^A-Z0-9]/g,'');j.vehicleType='R';}
  if(S.tid){j.transporterId=S.tid;j.transporterName=S.tname;}
  j.itemList=b.items.map(i=>({productName:i.desc.slice(0,100),productDesc:i.desc.slice(0,100),hsnCode:+i.hsn,quantity:i.qty,qtyUnit:i.unit,taxableAmount:i.av,sgstRate:0,cgstRate:0,igstRate:i.rate,cessRate:0,cessNonadvol:0}));
  return j;
}
function warns(b,j){
  const w=[];
  if(Math.abs(j.totalValue-b.assessable)>0.05)w.push('Items ka assessable sum ('+j.totalValue+') BOE ke total ('+b.assessable+') se match nahi karta');
  if(b.items.length>250)w.push('250 se zyada items hain; portal ek bill mein 250 tak hi leta hai');
  if(!/^[A-Za-z0-9\-\/.]{1,16}$/.test(b.docNo))w.push('Doc No 16 character tak aur sirf letters, numbers, - / . hona chahiye');
  if(!/^\d{2}\/\d{2}\/\d{4}$/.test(b.date))w.push('Date DD/MM/YYYY format mein honi chahiye');
  if(!/^\d{6}$/.test(b.toPin))w.push('Consignee pincode 6 digit ka hona chahiye');
  if(!b.items.length)w.push('Koi item nahi mila');
  if(b.items.some(i=>!i.unit||i.unit==='undefined'))w.push('Kisi item ka unit nahi mila');
  return w;
}
function render(){
  $('#out').innerHTML=bills.map((b,n)=>{const j=build(b),w=warns(b,j);
   const f=(k,l,wide)=>`<label class="${wide?'w':''}">${l}<input data-n="${n}" data-k="${k}" value="${esc(b[k])}"></label>`;
   return `<section class="card"><div class="row"><b>${esc(b.file)}</b><button class="ghost" data-rm="${n}">Hatao</button></div>
   <p class="meta">${b.items.length} items · Assessable ₹${j.totalValue} · Duty ₹${isNaN(b.duty)?'?':b.duty} · Invoice value ₹${j.totInvValue} · IGST ₹${j.igstValue} · Others ₹${j.otherValue}</p>
   ${w.map(x=>`<p class="warn">⚠ ${esc(x)}</p>`).join('')}
   <div class="grid">${f('docNo','Doc No')}${f('date','Doc Date')}<span></span>
   ${f('fromName','Consignor (From)',1)}${f('fromAddr','Consignor address',1)}${f('fromPlace','From place')}
   ${f('toName','Consignee (To)',1)}${f('toAddr','Consignee address',1)}${f('toPlace','To place')}${f('toPin','To pincode')}</div>
   <button class="ghost" data-dl="${n}">Sirf ye JSON download karo</button></section>`}).join('');
  $('#all').hidden=!bills.length;$('#all').textContent='Saare '+bills.length+' bill(s) ka JSON download karo';
}
async function dl(list,name){
  const data=JSON.stringify({version:'1.0.0621',billLists:list.map(build)},null,1);
  try{const u=URL.createObjectURL(new Blob([data],{type:'application/json'})),l=document.createElement('a');
    l.href=u;l.download=name;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);
    $('#msg').textContent='Download shuru: '+name;}
  catch(e){$('#fb').hidden=false;$('#fb textarea').value=data;$('#msg').textContent='Download nahi hua — neeche se JSON copy karke .json file mein save kar lo.';}
}
async function readPdf(file){
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,disableFontFace:true}).promise,pages=[];
  for(let i=1;i<=pdf.numPages;i++){const tc=await(await pdf.getPage(i)).getTextContent();pages.push(tc.items.map(t=>({s:t.str,x:t.transform[4],y:t.transform[5]})));}
  return parseBOE(pages);
}
async function add(files){
  for(const f of files){
    $('#msg').textContent=f.name+' padh raha hoon…';
    try{const b=await readPdf(f);b.file=f.name;b.docNo=(S.src==='cbe'?(b.cbe||'').replace(/[^A-Za-z0-9]/g,'').slice(-16):b.hawb);
      const p=prof(b.gstin);if(p)Object.assign(b,p);
      if(!S.gstin)S.gstin=b.gstin;bills.push(b);$('#msg').textContent='';}
    catch(e){$('#msg').textContent=f.name+': '+e.message;}
  }
  $('#gstin').value=S.gstin;render();save();
}
$('#file').onchange=e=>{add([...e.target.files]);e.target.value='';};
const dz=$('#drop');['dragover','dragenter'].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.add('on')}));
['dragleave','drop'].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.remove('on')}));
dz.addEventListener('drop',e=>add([...e.dataTransfer.files].filter(f=>/pdf$/i.test(f.name))));
$('#out').addEventListener('input',e=>{const t=e.target;if(t.dataset.k){const b=bills[t.dataset.n];b[t.dataset.k]=t.value;if(/^to/.test(t.dataset.k))saveProf(b);}});
$('#out').addEventListener('change',()=>render());
$('#out').addEventListener('click',e=>{const t=e.target;if(t.dataset.rm){bills.splice(+t.dataset.rm,1);render();}if(t.dataset.dl){const b=bills[+t.dataset.dl];dl([b],'EWB_'+b.docNo.replace(/\W/g,'')+'.json');}});
$('#all').onclick=()=>dl(bills,'EWB_bulk_'+bills.length+'_bills.json');
$('#disp').innerHTML=Object.keys(ST).map(s=>`<option ${s===S.disp?'selected':''}>${s}</option>`).join('');
[['gstin','gstin'],['disp','disp'],['dist','dist'],['tid','tid'],['tname','tname'],['veh','veh'],['src','src']].forEach(([id,k])=>{const el=$('#'+id);el.value=S[k]??'';el.addEventListener('input',()=>{S[k]=el.value;save();});el.addEventListener('change',()=>render());});


$('#clr').onclick=()=>{try{localStorage.clear()}catch(e){}bills=[];S={disp:'DELHI',dist:20,tid:'',tname:'',veh:'',src:'hawb',gstin:''};['gstin','dist','tid','tname','veh'].forEach(i=>$('#'+i).value='');$('#fb textarea').value='';$('#fb').hidden=true;render();$('#msg').textContent='Saved data aur loaded BOE hata diye.';};
window.addEventListener('pagehide',()=>{bills=[];});
