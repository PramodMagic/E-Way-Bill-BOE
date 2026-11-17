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
  if(!/Courier Bill Of Entry/i.test(t1)) throw new Error('This does not look like a Courier Bill of Entry (CBE-XIII)');
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
let S={disp:'DELHI',dist:20,tid:'',tname:'',veh:'',src:'hawb',gstin:'',mode:'rate',tdate:'today'},bills=[];
try{Object.assign(S,JSON.parse(localStorage.getItem('ewb_set')||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem('ewb_set',JSON.stringify(S))}catch(e){}};
const prof=g=>{try{return JSON.parse(localStorage.getItem('ewb_p_'+g)||'null')}catch(e){return null}};
const saveProf=b=>{try{localStorage.setItem('ewb_p_'+b.gstin,JSON.stringify({toName:b.toName,toAddr:b.toAddr,toPlace:b.toPlace,toPin:b.toPin}))}catch(e){}};
const STN=Object.fromEntries(Object.entries(ST).map(([k,v])=>[v,k]));
const r2=n=>Math.round(n*100)/100;
function build(b){
  const ig=r2(b.items.reduce((a,i)=>a+i.igst,0)),tv=r2(b.items.reduce((a,i)=>a+i.av,0));
  const duty=isNaN(b.duty)?b.items.reduce((a,i)=>a+i.igst+i.oth+i.cess,0):b.duty;
  const dc=ST[S.disp]||7,sc=b.stateCode||+b.gstin.slice(0,2);
  const j={userGstin:S.gstin||b.gstin,supplyType:'I',subSupplyType:2,subSupplyDesc:'',docType:'BOE',docNo:b.docNo,docDate:b.date,
   fromGstin:'URP',fromTrdName:nm(b.fromName),fromAddr1:clean(b.fromAddr).slice(0,120),fromAddr2:clean(b.fromAddr).slice(120,240),fromPlace:clean(b.fromPlace),fromPincode:999999,actFromStateCode:dc,fromStateCode:99,
   toGstin:b.gstin,toTrdName:nm(b.toName),toAddr1:clean(b.toAddr).slice(0,120),toAddr2:clean(b.toAddr).slice(120,240),toPlace:clean(b.toPlace),toPincode:+b.toPin,actToStateCode:sc,toStateCode:sc,
   transactionType:1,otherValue:r2(duty-ig),totalValue:tv,cgstValue:0,sgstValue:0,igstValue:ig,cessValue:0,cessNonAdvolValue:0,totInvValue:Math.round(tv+duty),
   transDistance:String(S.dist||0)};
  if(S.veh){j.transMode=1;j.vehicleNo=S.veh.toUpperCase().replace(/[^A-Z0-9]/g,'');j.vehicleType='R';}
  if(S.tdate==='today'){const d=new Date(),p=n=>String(n).padStart(2,'0');j.transDocDate=p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear();}
  else if(S.tdate==='doc')j.transDocDate=b.date;
  if(S.tid){j.transporterId=S.tid;j.transporterName=S.tname;}
  j.itemList=grp(b.items,S.mode).map(i=>({productName:i.desc.slice(0,100),productDesc:i.desc.slice(0,100),hsnCode:+i.hsn,quantity:i.qty,qtyUnit:i.unit,taxableAmount:i.av,sgstRate:0,cgstRate:0,igstRate:i.rate,cessRate:0,cessNonadvol:0}));
  return j;
}
function warns(b,j){
  const w=[];
  if(Math.abs(j.totalValue-b.assessable)>0.05)w.push('Sum of item assessable values ('+j.totalValue+') does not match the BOE total ('+b.assessable+')');
  if(b.items.length>250)w.push('More than 250 items; the portal accepts at most 250 items per bill');
  if(!/^[A-Za-z0-9\-\/.]{1,16}$/.test(b.docNo))w.push('Doc No must be up to 16 characters: letters, numbers, - / . only');
  if(!/^\d{2}\/\d{2}\/\d{4}$/.test(b.date))w.push('Date must be in DD/MM/YYYY format');
  if(!/^\d{6}$/.test(b.toPin))w.push('Consignee pincode must be 6 digits');
  if(!b.items.length)w.push('No items found');
  if(b.items.some(i=>!i.unit||i.unit==='undefined'))w.push('Unit missing for one or more items');
  return w;
}
function render(){
  $('#out').innerHTML=bills.map((b,n)=>{const j=build(b),w=warns(b,j);
   const f=(k,l,wide)=>`<label class="${wide?'w':''}">${l}<input data-n="${n}" data-k="${k}" value="${esc(b[k])}"></label>`;
   return `<section class="card"><div class="row"><b>${esc(b.file)}</b><button class="ghost" data-rm="${n}">Remove</button></div>
   <p class="meta">${b.items.length} items (${grp(b.items,S.mode).length} row(s) in Excel) · Assessable ₹${j.totalValue} · Duty ₹${isNaN(b.duty)?'?':b.duty} · Invoice value ₹${j.totInvValue} · IGST ₹${j.igstValue} · Others ₹${j.otherValue}</p>
   ${w.map(x=>`<p class="warn">⚠ ${esc(x)}</p>`).join('')}
   <div class="grid">${f('docNo','Doc No')}${f('date','Doc Date')}<span></span>
   ${f('fromName','Consignor (From)',1)}${f('fromAddr','Consignor address',1)}${f('fromPlace','From place')}
   ${f('toName','Consignee (To)',1)}${f('toAddr','Consignee address',1)}${f('toPlace','To place')}${f('toPin','To pincode')}</div>
   </section>`}).join('');
  $('#all').hidden=!bills.length;$('#json').hidden=!bills.length;$('#json').textContent='Download JSON for portal ('+bills.length+' BOE)';$('#all').textContent='Download Excel ('+bills.length+' BOE)';
}
const UNIT={"BAG":"BAGS","BAL":"BALE","BDL":"BUNDLES","BKL":"BUCKLES","BOU":"BILLION OF UNITS","BOX":"BOX","BTL":"BOTTLES","BUN":"BUNCHES","CAN":"CANS","CBM":"CUBIC METERS","CCM":"CUBIC CENTIMETERS","CMS":"CENTI METERS","CTN":"CARTONS","DOZ":"DOZENS","DRM":"DRUMS","GGK":"GREAT GROSS","GMS":"GRAMMES","GRS":"GROSS","GYD":"GROSS YARDS","KGS":"KILOGRAMS","KLR":"KILOLITRE","KME":"KILOMETRE","LTR":"LITRES","MLT":"MILILITRE","MTR":"METERS","MTS":"METRIC TON","NOS":"NUMBERS","OTH":"OTHERS","PAC":"PACKS","PCS":"PIECES","PRS":"PAIRS","QTL":"QUINTAL","ROL":"ROLLS","SET":"SETS","SQF":"SQUARE FEET","SQM":"SQUARE METERS","SQY":"SQUARE YARDS","TBS":"TABLETS","TGM":"TEN GROSS","THD":"THOUSANDS","TON":"TONNES","TUB":"TUBES","UGS":"US GALLONS","UNT":"UNITS","YDS":"YARDS"};
const nm=s=>clean(s).replace(/,/g,' ').replace(/\s+/g,' ').trim();
function grp(items,mode){
  if(mode==='all')return items;
  const m=new Map();
  for(const i of items){const k=mode==='one'?'x':i.rate;if(!m.has(k))m.set(k,[]);m.get(k).push(i);}
  let g=[...m.values()].map(a=>{const t=a.reduce((x,y)=>y.av>x.av?y:x,a[0]);
    return {hsn:t.hsn,desc:t.desc,unit:t.unit,rate:t.rate,qty:a.reduce((x,y)=>x+y.qty,0),av:r2(a.reduce((x,y)=>x+y.av,0)),igst:a.reduce((x,y)=>x+y.igst,0),oth:a.reduce((x,y)=>x+y.oth,0),cess:0};});
  if(mode==='one'){const top=g[0],rt=items.reduce((o,i)=>{o[i.rate]=(o[i.rate]||0)+i.av;return o;},{});top.rate=+Object.keys(rt).sort((a,b)=>rt[b]-rt[a])[0];}
  return g;
}
function exRows(b){
  const j=build(b),duty=isNaN(b.duty)?b.items.reduce((a,i)=>a+i.igst+i.oth,0):b.duty;
  const diff=r2(duty-b.items.reduce((a,i)=>a+i.igst+i.oth,0));
  const h={A:'Inward',B:'Import',C:'Bill of Entry',D:b.docNo,E:b.date,F:nm(b.fromName),G:'URP',H:clean(b.fromAddr).slice(0,120),J:clean(b.fromPlace),K:999999,L:'OTHER COUNTRIES',M:S.disp,
   N:nm(b.toName),O:b.gstin,P:clean(b.toAddr).slice(0,120),R:clean(b.toPlace),S:+b.toPin,T:STN[j.toStateCode]||'HARYANA',U:STN[j.toStateCode]||'HARYANA',AK:+S.dist||0};
  if(S.veh){h.AJ='Road';h.AP=S.veh.toUpperCase().replace(/[^A-Z0-9]/g,'');h.AQ='Regular';}
  if(S.tdate==='today'){const d=new Date(),p=n=>String(n).padStart(2,'0');h.AO=p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear();}
  else if(S.tdate==='doc')h.AO=b.date;
  if(S.tid){h.AL=clean(S.tname);h.AM=S.tid;}
  return grp(b.items,S.mode).map((i,n)=>({...h,V:i.desc.slice(0,100),W:i.desc.slice(0,100),X:+i.hsn,Y:UNIT[i.unit]||i.unit,Z:i.qty,AA:i.av,AB:'0+0+'+i.rate+'+0+0',AC:0,AD:0,AE:i.igst,AF:0,AG:0,AH:j.otherValue,AI:j.totInvValue}));
}
const colN=L=>L.split('').reduce((a,c)=>a*26+c.charCodeAt(0)-64,0);
const colL=n=>{let r='';while(n){const m=(n-1)%26;r=String.fromCharCode(65+m)+r;n=(n-m-1)/26|0;}return r;};
const xe=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
async function fillTemplate(buf,list){
  const z=await JSZip.loadAsync(buf);
  const wb=await z.file('xl/workbook.xml').async('string'),rel=await z.file('xl/_rels/workbook.xml.rels').async('string');
  const rid=(wb.match(/<sheet [^>]*name="eWayBill"[^>]*r:id="(rId\d+)"/)||[])[1];
  const tg=rid&&(rel.match(new RegExp('<Relationship [^>]*Id="'+rid+'"[^>]*Target="([^"]+)"'))||rel.match(new RegExp('<Relationship [^>]*Target="([^"]+)"[^>]*Id="'+rid+'"'))||[])[1];
  if(!tg)throw new Error('eWayBill sheet not found in the template');
  const path='xl/'+tg.replace(/^\/?(xl\/)?/,''),f=z.file(path);let s=await f.async('string');
  const cs={};for(const m of s.matchAll(/<col min="(\d+)" max="(\d+)"[^>]*?style="(\d+)"/g))for(let c=+m[1];c<=Math.min(+m[2],46);c++)cs[c]=m[3];
  s=s.replace(/<row r="(\d+)"[^>]*>.*?<\/row>/gs,(x,r)=>+r>=4?'':x);
  let n=4,out='';
  for(const b of list)for(const d of exRows(b)){
    let cells='';
    for(let c=1;c<=43;c++){const L=colL(c);if(d[L]===undefined||d[L]==='')continue;const st=cs[c]||'0',v=d[L];
      cells+=typeof v==='string'?`<c r="${L}${n}" s="${st}" t="inlineStr"><is><t>${xe(v)}</t></is></c>`:`<c r="${L}${n}" s="${st}"><v>${v}</v></c>`;}
    out+=`<row r="${n}" spans="1:45">${cells}</row>`;n++;
  }
  s=s.replace('</sheetData>',out+'</sheetData>').replace(/<dimension ref="[^"]*"\/>/,`<dimension ref="A1:AS${n-1}"/>`);
  z.file(path,s);
  const z2=new JSZip();
  for(const k of Object.keys(z.files)){const e=z.files[k];if(!e.dir)z2.file(k,await e.async('uint8array'),{date:e.date,createFolders:false});}
  return z2.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
let TPL=null;
async function loadTpl(){try{const r=await fetch('template.xlsm');if(r.ok)TPL=await r.arrayBuffer();}catch(e){}}
loadTpl();
async function dl(list,name){
  try{
    if(!TPL){$('#msg').textContent='Template not found. Choose your EWB_Preparation_Tool .xlsm using the Template field above.';return;}
    const bytes=await fillTemplate(TPL,list);
    const u=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.ms-excel.sheet.macroEnabled.12'})),l=document.createElement('a');
    l.href=u;l.download=name;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);
    $('#msg').textContent='Excel download started: '+name;
  }catch(e){$('#msg').textContent='Could not create Excel: '+e.message;}
}
async function readPdf(file){
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,disableFontFace:true}).promise,pages=[];
  for(let i=1;i<=pdf.numPages;i++){const tc=await(await pdf.getPage(i)).getTextContent();pages.push(tc.items.map(t=>({s:t.str,x:t.transform[4],y:t.transform[5]})));}
  return parseBOE(pages);
}
async function add(files){
  for(const f of files){
    $('#msg').textContent=f.name+': reading…';
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
$('#out').addEventListener('click',e=>{const t=e.target;if(t.dataset.rm){bills.splice(+t.dataset.rm,1);render();}if(t.dataset.dl){const b=bills[+t.dataset.dl];dl([b],'EWB_'+b.docNo.replace(/\W/g,'')+'.xlsm');}});
$('#json').onclick=()=>{
  const data=JSON.stringify({version:'1.0.0621',billLists:bills.map(build)},null,1);
  const u=URL.createObjectURL(new Blob([data],{type:'application/json'})),l=document.createElement('a');
  l.href=u;l.download='EWB_'+bills.length+'_BOE.json';document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);
  $('#msg').textContent='JSON download started (.json file).';};
$('#all').onclick=()=>dl(bills,'EWB_Prepared_'+bills.length+'_BOE.xlsm');
$('#tpl').onchange=async e=>{const f=e.target.files[0];if(f){TPL=await f.arrayBuffer();$('#msg').textContent='Template set: '+f.name;}};
$('#disp').innerHTML=Object.keys(ST).map(s=>`<option ${s===S.disp?'selected':''}>${s}</option>`).join('');
[['gstin','gstin'],['disp','disp'],['dist','dist'],['tid','tid'],['tname','tname'],['veh','veh'],['src','src'],['mode','mode'],['tdate','tdate']].forEach(([id,k])=>{const el=$('#'+id);el.value=S[k]??'';el.addEventListener('input',()=>{S[k]=el.value;save();});el.addEventListener('change',()=>render());});


$('#clr').onclick=()=>{try{localStorage.clear()}catch(e){}bills=[];S={disp:'DELHI',dist:20,tid:'',tname:'',veh:'',src:'hawb',gstin:'',mode:'rate',tdate:'today'};['gstin','dist','tid','tname','veh'].forEach(i=>$('#'+i).value='');$('#fb textarea').value='';$('#fb').hidden=true;render();$('#msg').textContent='Saved data and loaded BOEs cleared.';};
window.addEventListener('pagehide',()=>{bills=[];});
