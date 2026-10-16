import {validateAccess,validateConversation,sealConversation,openConversation,freshConversationInvitation,encode} from './codec.js';
const $=id=>document.getElementById(id);
const STORE='bibleCompanion.conversations.v1';
const safeGet=key=>{try{return localStorage.getItem(key);}catch{return null;}};
const safeSet=(key,value)=>{try{localStorage.setItem(key,value);return true;}catch{return false;}};
let viewer=safeGet('bibleCompanion.viewerID');
if(!viewer || !/^[0-9a-f-]{36}$/i.test(viewer)){viewer=crypto.randomUUID();safeSet('bibleCompanion.viewerID',viewer);}
let stopped=false;
window.addEventListener('pagehide',()=>{stopped=true;});
export function stopCurrentConversation(){stopped=true;}
export function forgetCachedConversation(id){
  try{const data=JSON.parse(localStorage.getItem(STORE)||'{"version":1,"items":[]}');if(data.version!==1||!Array.isArray(data.items))return;data.items=data.items.filter(x=>x.conversation?.invitation?.conversation?.id!==id);localStorage.setItem(STORE,JSON.stringify(data));localStorage.removeItem('bibleCompanion.draft.'+id);}catch{}
}
export async function startConversation(invitation){
  const access=validateAccess(invitation.conversation);
  $('chat-card').hidden=false;
  const endpoint='/together/api/conversations/'+encodeURIComponent(access.id.toLowerCase());
  let snapshot,revision=0,sending=false,pending,rendered='',ended=false,sendFailed=false,delivery='';
  const draftKey='bibleCompanion.draft.'+access.id;
  $('chat-name').value=safeGet('bibleCompanion.readerName')||'';
  try{const draft=JSON.parse(safeGet(draftKey)||'{}');$('chat-message').value=typeof draft.text==='string'?draft.text:'';pending=draft.pending;sendFailed=!!pending;}catch{}
  const keepDraft=()=>safeSet(draftKey,JSON.stringify({text:$('chat-message').value,pending}));
  const status=text=>$('chat-status').textContent=text;
  function cache(value,version){
    try{
      const raw=localStorage.getItem(STORE),data=raw?JSON.parse(raw):{version:1,items:[]};
      if(data.version!==1||!Array.isArray(data.items))throw Error();
      for(const item of data.items){validateConversation(item.conversation,item.conversation.invitation);if(!Number.isInteger(item.revision)||item.revision<1)throw Error();}
      data.items=data.items.filter(x=>x.conversation.invitation.conversation.id.toLowerCase()!==access.id.toLowerCase());
      data.items.unshift({conversation:value,revision:version});localStorage.setItem(STORE,JSON.stringify(data));
    }catch{status('This browser couldn’t save a local copy. Keep the gift link to reopen it. Live messages are temporary; existing local data was not replaced.');}
  }
  function render(value){
    const signature=JSON.stringify(value.messages);
    if(signature===rendered)return;rendered=signature;
    const holder=$('chat-messages');holder.replaceChildren();
    if(!value.messages.length){const p=document.createElement('p');p.className='chat-empty';p.textContent='What did this bring to mind? A little thought is a lovely place to start.';holder.append(p);}
    for(const message of value.messages){
      const card=document.createElement('article'),name=document.createElement('span'),words=document.createElement('p'),time=document.createElement('time');
      const mine=message.authorID.toLowerCase()===viewer.toLowerCase();card.className='chat-message'+(mine?' mine':'');
      name.className='eyebrow';name.textContent=mine?'YOU':message.authorName||'YOUR PERSON';words.textContent=message.text;
      time.dateTime=message.createdAt;time.textContent=new Date(message.createdAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
      card.append(name,words,time);holder.append(card);
    }
    if(pending && value.messages.some(m=>m.id===pending.id) && $('chat-message').value.trim()===pending.text){$('chat-message').value='';pending=undefined;sendFailed=false;delivery='Sent · saved on this browser';keepDraft();}
  }
  async function request(method,body,target=access,expected=invitation){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    try{
      const response=await fetch('/together/api/conversations/'+encodeURIComponent(target.id.toLowerCase()),{method,headers:{Authorization:'Bearer '+target.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
      if(response.status===404){const error=Error('This temporary conversation is no longer available.');error.ended=true;throw error;}
      if(response.status===409){const error=Error('New messages arrived. Your draft is still here; try Send again.');error.conflict=true;throw error;}
      if(!response.ok)throw Error('The conversation couldn’t connect. Your gift and draft are still here. Try again in a moment.');
      const wire=await response.json();if(!Number.isInteger(wire.revision)||wire.revision<1)throw Error('This conversation could not be verified.');
      const value=await openConversation(wire.payload,expected);return{value,revision:wire.revision};
    }finally{clearTimeout(timer);}
  }
  function controls(){
    $('chat-send').textContent=sending?'Sending…':sendFailed?'Retry message ↗':'Send message ↗';
    $('chat-send').disabled=sending||ended||!snapshot||snapshot.messages.length>=200||!$('chat-message').value.trim();
    $('chat-ended').hidden=!ended;
  }
  async function refresh(){
    try{
      const result=await request('GET');if(stopped)return;
      snapshot=result.value;revision=result.revision;ended=false;render(snapshot);cache(snapshot,revision);
      if(!sendFailed)status(delivery);
      if(snapshot.messages.length>=200)status('This conversation is full. Start a new conversation to keep talking.');
    }catch(error){
      if(!stopped){ended=!!error.ended;status(ended?'':"Couldn't refresh. Your gift, downloaded messages, and draft are still here. Try Refresh when connected.");}
    }
    controls();
  }
  try{
    const data=JSON.parse(safeGet(STORE)||'{"version":1,"items":[]}');
    if(data.version===1&&Array.isArray(data.items)){
      const saved=data.items.find(x=>x.conversation?.invitation?.conversation?.id.toLowerCase()===access.id.toLowerCase());
      if(saved){validateConversation(saved.conversation,invitation);snapshot=saved.conversation;revision=saved.revision;render(snapshot);}
    }
  }catch{}
  $('chat-refresh').addEventListener('click',()=>{if(!sending)refresh();});
  $('chat-share').addEventListener('click',async()=>{
    try{if(navigator.share)await navigator.share({title:'Our conversation · Bible Companion',url:location.href});else{await navigator.clipboard.writeText(location.href);status('Conversation link copied. Send it to your person.');}}
    catch(error){if(error.name!=='AbortError')status('Copy the complete link from your address bar to share this conversation.');}
  });
  $('chat-restart').addEventListener('click',async()=>{
    $('chat-restart').disabled=true;status('Opening a fresh conversation…');
    try{
      const fresh=freshConversationInvitation(invitation,$('chat-name').value),value={invitation:fresh,messages:[]};
      const link=await encode({version:1,invitation:fresh},location.origin);
      await request('POST',{payload:await sealConversation(value)},fresh.conversation,fresh);
      safeSet('bibleCompanion.draft.'+fresh.conversation.id,JSON.stringify({text:$('chat-message').value}));
      // Keep the original gift and its cached history; a fresh link starts a separate conversation.
      location.assign(link);
    }catch{status("A fresh conversation couldn't connect yet. Your gift and draft are still here. Try again in a moment.");$('chat-restart').disabled=false;}
  });
  $('chat-send').disabled=true;
  $('chat-message').addEventListener('input',()=>{keepDraft();controls();});
  $('chat-name').addEventListener('input',()=>safeSet('bibleCompanion.readerName',$('chat-name').value));
  $('chat-send').addEventListener('click',async()=>{
    const words=$('chat-message').value.trim(),name=$('chat-name').value.trim();
    if(sending||!words||[...words].length>1500||[...name].length>60||!snapshot)return;
    sending=true;sendFailed=false;delivery='';controls();$('chat-send').disabled=true;$('chat-message').disabled=true;$('chat-name').disabled=true;status('Sending…');
    if(!pending||pending.text!==words||pending.authorName!==name)pending={id:crypto.randomUUID(),createdAt:new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),authorID:viewer,authorName:name,text:words};
    keepDraft();safeSet('bibleCompanion.readerName',name);
    try{
      let sent=false;
      for(let attempt=0;attempt<3;attempt++){
        const latest=await request('GET');if(latest.value.messages.some(x=>x.id===pending.id)){snapshot=latest.value;revision=latest.revision;sent=true;break;}
        if(latest.value.messages.length>=200)throw Error('This conversation is full. Start a new gift to keep talking.');
        latest.value.messages.push(pending);
        try{const result=await request('PUT',{revision:latest.revision,payload:await sealConversation(latest.value)});snapshot=result.value;revision=result.revision;sent=true;break;}
        catch(error){if(!error.conflict||attempt===2)throw error;}
      }
      if(sent){$('chat-message').value='';pending=undefined;keepDraft();delivery='Sent · saved on this browser';status(delivery);render(snapshot);cache(snapshot,revision);}
    }catch(error){ended=!!error.ended;sendFailed=true;status(ended?'':"Your message wasn't confirmed. Your draft is saved. Retry when connected; retrying won't send a duplicate.");}
    finally{sending=false;controls();$('chat-message').disabled=false;$('chat-name').disabled=false;}
  });
  await refresh();
  while(!stopped){await new Promise(resolve=>setTimeout(resolve,6000));if(!document.hidden&&!sending&&!ended)await refresh();}
}
