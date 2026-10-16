import {decode,fromCode,recoveryCode} from './path-codec.js';
const $=id=>document.getElementById(id);
let catalog,passages,current;
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
function fail(error){$('loading').hidden=true;$('invitation').hidden=true;$('import').hidden=false;$('error').textContent=error?.message||'The invitation could not be opened. Try the original link or PATH code.';}
async function show(i){
 current=i;const template=catalog.find(t=>t.id===i.templateID),steps=template.steps.filter(s=>i.stepIDs.includes(s.id));
 $('from').textContent=i.senderName?'An invitation from '+i.senderName:'Someone thought of you';
 $('title').textContent=i.title;$('message').textContent=i.message;$('message').hidden=!i.message;$('recovered').hidden=!i.recoveredFromCode;
 $('portrait').src='/together/assets/'+i.characterID+'.png';$('portrait').alt='Illustrated story guide '+i.characterID;
 $('guide-name').textContent=i.characterID[0].toUpperCase()+i.characterID.slice(1)+' · your story guide';
 $('summary').textContent=template.summary;$('plan-size').textContent=steps.length+' small steps · about '+i.suggestedMinutes+' minutes when you choose to read. No deadline.';
 $('steps').replaceChildren();
 steps.forEach((step,index)=>{
  const details=make('details');details.id='reading-'+index;
  const heading=make('summary');heading.append(make('span',String(index+1),'step-number'));
  const title=make('div');title.append(make('div',step.title,'step-title'),make('div',step.reference,'reference'));heading.append(title);details.append(heading);
  const text=make('div',null,'passage');
  for(const verse of passages[step.reference]||[]){const line=make('p');line.append(make('span',String(verse.verse),'verse-number'),make('span',verse.text));text.append(line);}
  details.append(text,make('p',step.question,'question'));$('steps').append(details);
 });
 const code=await recoveryCode(i,catalog);$('recovery-code').textContent=code;
 $('open-app').href=i.recoveredFromCode?'biblecompanion://path?code='+encodeURIComponent(code):'biblecompanion://path'+location.hash;
 $('loading').hidden=true;$('import').hidden=true;$('invitation').hidden=false;
}
$('code-open').addEventListener('click',async()=>{try{await show(await fromCode($('code-input').value,catalog));}catch(e){fail(e);}});
$('begin').addEventListener('click',()=>{const first=$('reading-0');if(first){first.open=true;first.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});}});
$('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('recovery-code').textContent);$('copy-status').textContent='Copied. Your path will be here when you are ready.';}catch{$('copy-status').textContent='Select the code above to copy it.';}});
async function load(){
 try{
  const results=await Promise.all([fetch('/path/catalog.json'),fetch('/path/passages.json')]);if(results.some(r=>!r.ok))throw Error('The path preview is unavailable. Keep your link and try again shortly.');
  [catalog,passages]=await Promise.all(results.map(r=>r.json()));
  const code=new URLSearchParams(location.search).get('code');
  if(location.hash)await show(await decode(location.hash,catalog));else if(code)await show(await fromCode(code,catalog));else fail(null);
  try{const config=await fetch('/path/config').then(r=>r.json());if(config.downloadURL){const url=new URL(config.downloadURL);if(url.protocol==='https:'&&['apps.apple.com','testflight.apple.com'].includes(url.hostname)){ $('download').href=url.href;$('download').hidden=false;$('install-note').textContent='Install the app, then return to this page and choose Open my path. You can also use the recovery code below.';}}}catch{/* The code and original link remain usable without installation configuration. */}
 }catch(e){fail(e);}
}
addEventListener('hashchange',load);load();
