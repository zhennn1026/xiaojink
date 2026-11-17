(() => {
'use strict';
const KEY='xiaojinku.friend.noinvest.v1', V2_KEY='xiaojinku.friend.noinvest.legacy.v2', OLD_KEY='xiaojinku.friend.noinvest.legacy.v1', MAX=10000000000, DAYS=364;
const $=id=>document.getElementById(id);
const fmt=n=>'NT$ '+Math.round(Number(n)||0).toLocaleString('zh-TW');
const short=n=>Math.round(Number(n)||0).toLocaleString('zh-TW');
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const today=()=>localDate(new Date());
const isDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&localDate(new Date(s+'T12:00:00'))===s;
const validMonth=s=>typeof s==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const monthIndex=m=>Number(m.slice(0,4))*12+Number(m.slice(5,7))-1;
const monthFrom=n=>String(Math.floor(n/12)).padStart(4,'0')+'-'+String(n%12+1).padStart(2,'0');
const thisMonth=()=>today().slice(0,7);
const uid=()=>globalThis.crypto?.randomUUID?.()||String(Date.now())+Math.random().toString(36).slice(2);
const isMoney=n=>Number.isSafeInteger(n)&&n>=0&&n<=MAX;
const centsInt=n=>Number.isSafeInteger(n)&&n>0&&n<=MAX;
const deep=x=>JSON.parse(JSON.stringify(x));
const currencyInput=(id)=>Number($(id).value);
const option=(v,label,selected)=>`<option value="${safe(v)}" ${v===selected?'selected':''}>${safe(label)}</option>`;
const accKind=k=>k==='cash'?'現金':k==='card'?'信用卡':'銀行';
const cashAccounts=()=>state.accounts.filter(a=>a.kind!=='card');
const cardAccounts=()=>state.accounts.filter(a=>a.kind==='card');
const accountById=id=>state.accounts.find(a=>a.id===id);
const isCashId=id=>!!state.accounts.find(a=>a.id===id&&a.kind!=='card');
const isCardId=id=>!!state.accounts.find(a=>a.id===id&&a.kind==='card');
const original=()=>({reserves:[],recurringReserves:[],version:2,accounts:[{id:'wallet',name:'錢包',kind:'cash',opening:0}],transactions:[],transfers:[],installments:[],cardCharges:[],cardPayments:[],investPlan:{symbol:'0050',monthly:0,startMonth:thisMonth(),active:false},investments:[],plan:{startDate:today(),step:20,deposits:{}},legacyWishes:[],updatedAt:new Date().toISOString()});
function fromLegacy(x){
 const fresh=original();
 fresh.plan={startDate:x.plan.startDate,step:x.plan.step,deposits:deep(x.plan.deposits)};
 fresh.transactions=x.transactions.map(t=>({...t,accountId:null}));
 fresh.installments=(x.installments||[]).map(t=>({...t,paidMonths:Array.isArray(t.paidMonths)?[...t.paidMonths]:[],paymentDetails:{}}));
 fresh.legacyWishes=Array.isArray(x.wishes)?deep(x.wishes):[];
 fresh.updatedAt=new Date().toISOString();
 return fresh;
}
function validV1(x){return x?.version===1&&x.plan&&isDate(x.plan.startDate)&&Number.isSafeInteger(x.plan.step)&&x.plan.step>=7&&x.plan.deposits&&typeof x.plan.deposits==='object'&&!Array.isArray(x.plan.deposits)&&Array.isArray(x.transactions)&&Array.isArray(x.installments||[])&&Array.isArray(x.wishes||[])}
function validV2(x){
 if(x?.version!==2||!x.plan||!isDate(x.plan.startDate)||!Number.isSafeInteger(x.plan.step)||x.plan.step<7||x.plan.step>1000000||!x.plan.deposits||Array.isArray(x.plan.deposits)||typeof x.plan.deposits!=='object')return false;
 for(const [k,v] of Object.entries(x.plan.deposits)){if(!/^\d+$/.test(k)||Number(k)>=DAYS||!v||!centsInt(v.amount))return false}
 if(!Array.isArray(x.accounts)||!Array.isArray(x.transactions)||!Array.isArray(x.transfers)||!Array.isArray(x.installments)||!Array.isArray(x.investments)||x.accounts.length>200||x.transactions.length>20000||x.transfers.length>10000||x.installments.length>500||x.investments.length>20000)return false;
 const seen=new Set();for(const a of x.accounts){if(!a||typeof a.id!=='string'||!a.id||seen.has(a.id)||typeof a.name!=='string'||a.name.length>50||!['cash','bank'].includes(a.kind)||!isMoney(a.opening))return false;seen.add(a.id)}
 for(const t of x.transactions){if(!t||typeof t.id!=='string'||!['income','expense'].includes(t.type)||!centsInt(t.amount)||!isDate(t.date)||typeof t.category!=='string'||t.category.length>50||typeof t.note!=='string'||t.note.length>200||!(t.accountId==null||seen.has(t.accountId)))return false}
 for(const t of x.transfers){if(!t||typeof t.id!=='string'||!centsInt(t.amount)||!isDate(t.date)||!seen.has(t.fromId)||!seen.has(t.toId)||t.fromId===t.toId)return false}
 for(const x1 of x.installments){if(!x1||typeof x1.id!=='string'||typeof x1.name!=='string'||!x1.name.trim()||x1.name.length>80||!centsInt(x1.total)||!Number.isSafeInteger(x1.months)||x1.months<1||x1.months>120||x1.total<x1.months||!validMonth(x1.startMonth)||!Array.isArray(x1.paidMonths)||!(x1.paymentDetails&&typeof x1.paymentDetails==='object'&&!Array.isArray(x1.paymentDetails)))return false;
 for(const m of x1.paidMonths)if(!validMonth(m)||monthIndex(m)<monthIndex(x1.startMonth)||monthIndex(m)>=monthIndex(x1.startMonth)+x1.months)return false;
 for(const [m,d] of Object.entries(x1.paymentDetails))if(!validMonth(m)||!x1.paidMonths.includes(m)||!d||!(d.accountId===null||seen.has(d.accountId))||!isDate(d.date))return false;
 }
 if(!x.investPlan||x.investPlan.symbol!=='0050'||!isMoney(x.investPlan.monthly)||!validMonth(x.investPlan.startMonth)||typeof x.investPlan.active!=='boolean')return false;
 for(const r of x.investments)if(!r||typeof r.id!=='string'||!centsInt(r.amount)||!isDate(r.date)||!(r.accountId==null||seen.has(r.accountId))||typeof r.note!=='string'||r.note.length>200||!Number.isFinite(r.units??0)||(r.units??0)<0)return false;
 return true;
}

function migrateV3(v2){
 const s=deep(v2);s.version=3;
 s.cardCharges=Array.isArray(s.cardCharges)?s.cardCharges:[];
 s.cardPayments=Array.isArray(s.cardPayments)?s.cardPayments:[];
 for(const inst of s.installments)if(inst.cardId===undefined)inst.cardId=null;
 return s;
}
function validV3(s){
 if(s.recurringReserves!==undefined){
  if(!Array.isArray(s.recurringReserves)||s.recurringReserves.length>500)return false;
  const seenRecurring=new Set();
  for(const r of s.recurringReserves){
   if(!r||typeof r.id!=='string'||!r.id||seenRecurring.has(r.id)||typeof r.name!=='string'||!r.name.trim()||r.name.length>80||!centsInt(r.amount)||!validMonth(r.startMonth)||!['保險費','購物備用','健康預留','其他預留'].includes(r.category)||typeof r.active!=='boolean'||!Array.isArray(r.skippedMonths)||r.skippedMonths.length>1200||r.skippedMonths.some(m=>!validMonth(m)))return false;
   seenRecurring.add(r.id);
  }
 }
 if(s.reserves!==undefined){
  if(!Array.isArray(s.reserves)||s.reserves.length>5000)return false;
  const ids=new Set();
  for(const r of s.reserves){
   if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||typeof r.name!=='string'||!r.name.trim()||r.name.length>80||!validMonth(r.month)||!centsInt(r.amount)||!['購物備用','健康預留','其他預留','保險費'].includes(r.category)||!(r.recurringId===undefined||typeof r.recurringId==='string')||!['reserved','spent'].includes(r.status)||!(r.transactionId===null||typeof r.transactionId==='string'))return false;
   if(r.status==='spent'&&!r.transactionId)return false;
   ids.add(r.id);
  }
 }
 if(!s||s.version!==3||!Array.isArray(s.cardCharges)||!Array.isArray(s.cardPayments)||s.cardCharges.length>20000||s.cardPayments.length>20000)return false;
 const cash=s.accounts?.filter(a=>a.kind!=='card')||[],cards=s.accounts?.filter(a=>a.kind==='card')||[];
 const cardIds=new Set(cards.map(a=>a.id)),cashIds=new Set(cash.map(a=>a.id));
 if(cards.length>100||cards.some(c=>typeof c.name!=='string'||c.name.length<1||c.name.length>50||!c.id||!isMoney(c.opening||0)||!isMoney(c.openingDebt)||!validMonth(c.openingDebtMonth)||!Number.isSafeInteger(c.statementDay)||c.statementDay<1||c.statementDay>28||!Number.isSafeInteger(c.dueDay)||c.dueDay<1||c.dueDay>28||!(c.limit===null||isMoney(c.limit))||!(c.paymentAccountId===null||cashIds.has(c.paymentAccountId))||typeof c.issuer!=='string'||c.issuer.length>50||(c.autopayMode!==undefined&&!['unknown','full','minimum','off'].includes(c.autopayMode))||!(c.unbilledSnapshot===undefined||c.unbilledSnapshot===null||isMoney(c.unbilledSnapshot))||(c.unbilledAsOf!==undefined&&c.unbilledAsOf!==null&&!isDate(c.unbilledAsOf))||!(c.pendingPaymentAmount===undefined||isMoney(c.pendingPaymentAmount))||(c.pendingPaymentAsOf!==undefined&&c.pendingPaymentAsOf!==null&&!isDate(c.pendingPaymentAsOf))))return false;
 if(new Set(s.accounts.map(a=>a.id)).size!==s.accounts.length)return false;
 // Retain existing 2.x data validation, including historical transfers, without enabling transfers again.
 const legacy={...s,version:2,accounts:cash,installments:s.installments.map(({cardId,...rest})=>rest)};
 if(!validV2(legacy))return false;
 for(const i of s.installments)if(!(i.cardId==null||cardIds.has(i.cardId)))return false;
 const charges=new Set();for(const c of s.cardCharges){
  if(!c||!c.id||charges.has(c.id)||!cardIds.has(c.cardId)||!isDate(c.date)||!validMonth(c.dueMonth)||!centsInt(c.amount)||!isMoney(c.refunded)||c.refunded>c.amount||typeof c.category!=='string'||c.category.length>50||typeof c.note!=='string'||c.note.length>200)return false;charges.add(c.id)
 }
 const pays=new Set();for(const x of s.cardPayments){
  if(!x||!x.id||pays.has(x.id)||!cardIds.has(x.cardId)||!(x.accountId===null||cashIds.has(x.accountId))||!isDate(x.date)||!centsInt(x.amount)||!['charge','installment','opening'].includes(x.sourceType)||typeof x.groupId!=='string'||!x.groupId)return false;pays.add(x.id);
  if(x.sourceType==='charge'&&(!s.cardCharges.some(c=>c.id===x.sourceId&&c.cardId===x.cardId)))return false;
  if(x.sourceType==='opening'&&x.sourceId!==x.cardId)return false;
  if(x.sourceType==='installment'&&(!validMonth(x.sourceMonth)||!s.installments.some(i=>i.id===x.sourceId&&i.cardId===x.cardId&&due(i,x.sourceMonth)>0)))return false;
 }
 for(const c of s.cardCharges)if(cardPaymentSum('charge',c.id,null,s)>c.amount-c.refunded)return false;
 for(const c of cards)if(cardPaymentSum('opening',c.id,null,s)>c.openingDebt)return false;
 for(const i of s.installments)for(let n=0;n<i.months;n++){const m=monthFrom(monthIndex(i.startMonth)+n);if(cardPaymentSum('installment',i.id,m,s)>(i.paidMonths.includes(m)?0:due(i,m)))return false}
 return true;
}

let state=migrateV3(original()),page='home',homeMonth=thisMonth(),ledgerMonth=thisMonth(),installMonth=thisMonth(),selectedWeek=0,ledgerFilter='all',saveError=false,blocked=false,noticeTimer=null,wasMigrated=false;
try{
 const newest=localStorage.getItem(KEY);
 if(newest){const parsed=JSON.parse(newest);if(validV3(parsed))state=parsed;else {blocked=true;saveError=true}}
 else {
  const previous=localStorage.getItem(V2_KEY);
  const old=previous||localStorage.getItem(OLD_KEY);
  if(old){const parsed=JSON.parse(old);if(validV2(parsed)) {state=migrateV3(parsed);wasMigrated=true}
   else if(validV1(parsed)){state=migrateV3(fromLegacy(parsed));wasMigrated=true}
   else {blocked=true;saveError=true}}
  if(!blocked)localStorage.setItem(KEY,JSON.stringify(state));
 }
}catch(e){saveError=true;blocked=true}

const countSaved=()=>Object.keys(state.plan.deposits).length;
const saved=()=>Object.values(state.plan.deposits).reduce((s,x)=>s+x.amount,0);
const goal=()=>state.plan.step*1378;
const percent=(a,b)=>b>0?Math.max(0,Math.min(100,100*a/b)):0;
const amtDay=i=>{const weekly=(Math.floor(i/7)+1)*state.plan.step,base=Math.floor(weekly/7);return base+(i%7<weekly%7?1:0)};
const dateFor=i=>{const d=new Date(state.plan.startDate+'T12:00:00');d.setDate(d.getDate()+i);return localDate(d)};
const currentWeek=()=>Math.max(0,Math.min(51,Math.floor((new Date(today()+'T12:00:00')-new Date(state.plan.startDate+'T12:00:00'))/86400000/7)));
selectedWeek=currentWeek();
function due(x,m){const i=monthIndex(m)-monthIndex(x.startMonth);return i>=0&&i<x.months?Math.floor(x.total/x.months)+(i===x.months-1?x.total%x.months:0):0}
function cardPaymentSum(type,id,month,s=state){return s.cardPayments.reduce((t,p)=>t+((p.sourceType===type&&p.sourceId===id&&(type!=='installment'||p.sourceMonth===month))?p.amount:0),0)}
const legacyPaid=(x,m)=>x.paidMonths.includes(m);
const paidAmt=(x,m)=>legacyPaid(x,m)?due(x,m):Math.min(due(x,m),cardPaymentSum('installment',x.id,m));
const paid=(x,m)=>paidAmt(x,m)>=due(x,m);
const remainingInst=(x,m)=>Math.max(0,due(x,m)-paidAmt(x,m));
function cardChargeRemaining(c){return Math.max(0,c.amount-c.refunded-cardPaymentSum('charge',c.id))}
function cardOpeningRemaining(c){return Math.max(0,c.openingDebt-cardPaymentSum('opening',c.id))}
function cardComponents(id,until){
 const card=accountById(id);if(!card||card.kind!=='card')return [];
 const rows=[];
 if(cardOpeningRemaining(card)>0&&card.openingDebtMonth<=until)rows.push({type:'opening',id:card.id,month:card.openingDebtMonth,label:'期初未繳帳款',remaining:cardOpeningRemaining(card)});
 for(const c of state.cardCharges)if(c.cardId===id&&c.dueMonth<=until&&cardChargeRemaining(c)>0)rows.push({type:'charge',id:c.id,month:c.dueMonth,label:c.category+(c.note?' · '+c.note:''),remaining:cardChargeRemaining(c)});
 for(const i of state.installments.filter(i=>i.cardId===id))for(let n=0;n<i.months;n++){const m=monthFrom(monthIndex(i.startMonth)+n),remain=remainingInst(i,m);if(m<=until&&remain>0)rows.push({type:'installment',id:i.id,month:m,label:i.name+' · 第 '+(n+1)+' 期',remaining:remain})}
 return rows.sort((a,b)=>a.month.localeCompare(b.month)||a.type.localeCompare(b.type));
}
const cardBillOutstanding=(id,month)=>cardComponents(id,month).reduce((s,r)=>s+r.remaining,0);
const totalCardDue=month=>state.cardCharges.filter(c=>c.dueMonth===month).reduce((s,c)=>s+c.amount-c.refunded,0)+cardAccounts().filter(c=>c.openingDebtMonth===month).reduce((s,c)=>s+c.openingDebt,0)+state.installments.filter(i=>i.cardId).reduce((s,i)=>s+due(i,month),0);
const totalCardOutstanding=id=>{const c=accountById(id);if(!c||c.kind!=='card')return 0;let balance=cardOpeningRemaining(c);for(const a of state.cardCharges)if(a.cardId===id)balance+=cardChargeRemaining(a);for(const i of state.installments)if(i.cardId===id)for(let n=0;n<i.months;n++)balance+=remainingInst(i,monthFrom(monthIndex(i.startMonth)+n));return balance};
// Figures are grouped by the bill's due month, not the day payment was entered.
// A past month's paid amount is still shown when viewing that month's statement.
function cardMonthlySummary(cardId,month){
 const c=accountById(cardId);
 if(!c||c.kind!=='card'||!validMonth(month))return {billed:0,paid:0,remaining:0};
 let billed=0,paid=0;
 if(c.openingDebtMonth===month){billed+=c.openingDebt;paid+=cardPaymentSum('opening',c.id,null)}
 for(const x of state.cardCharges)if(x.cardId===cardId&&x.dueMonth===month){billed+=x.amount-x.refunded;paid+=cardPaymentSum('charge',x.id,null)}
 for(const x of state.installments)if(x.cardId===cardId){const value=due(x,month);if(value){billed+=value;paid+=paidAmt(x,month)}}
 return {billed,paid,remaining:Math.max(0,billed-paid)};
}
// Available credit is not bank cash. It counts the full unpaid installment balance,
// including future months, so the same debt is never counted twice.
function cardAvailable(cardId){const c=accountById(cardId);return !c||c.kind!=='card'||c.limit===null?null:Math.max(0,c.limit-totalCardOutstanding(cardId))}
function cardDueMonth(card,date){const d=Number(date.slice(8,10));return monthFrom(monthIndex(date.slice(0,7))+(d>card.statementDay?1:0)+(card.dueDay<=card.statementDay?1:0))}

const totalDue=m=>state.installments.reduce((s,x)=>s+due(x,m),0);
const plannedInvest=m=>0; // 朋友版不計入 0050 固定投資預算
const txSum=(m,type,cat)=>state.transactions.filter(t=>t.date.startsWith(m)&&t.type===type&&(!cat||t.category===cat)).reduce((s,t)=>s+t.amount,0);
const investCost=()=>state.investments.reduce((s,r)=>s+r.amount,0);
const accountName=id=>state.accounts.find(a=>a.id===id)?.name||'未指定帳戶';
const accountOpts=(selected,allowNull=true)=>`${allowNull?option('','不指定帳戶（只記錄，不更新餘額）',selected||''):''}${cashAccounts().map(a=>option(a.id,a.name,selected)).join('')}`;
const unbilledText=c=>c.unbilledSnapshot==null?'未登錄':fmt(c.unbilledSnapshot);
const pendingPaidText=c=>c.pendingPaymentAmount>0?`另有 ${fmt(c.pendingPaymentAmount)} 已繳、待銀行畫面確認；若成功入帳，本期約剩 ${fmt(Math.max(0,cardMonthlySummary(c.id,c.openingDebtMonth).remaining-c.pendingPaymentAmount))}`:'';
const bankKnownDebtText=c=>c.unbilledSnapshot==null?'未登錄':fmt(cardMonthlySummary(c.id,c.openingDebtMonth).remaining+c.unbilledSnapshot);
const autopayLabel=c=>({full:'銀行自動扣繳：全額',minimum:'銀行自動扣繳：最低',off:'銀行自動扣繳：已取消',unknown:'銀行自動扣繳：尚未確認'})[c.autopayMode||'unknown'];
const cardOpts=(selected,allowNull=true)=>`${allowNull?option('','尚未指定信用卡',selected||''):''}${cardAccounts().map(a=>option(a.id,a.name,selected)).join('')}`;
function accountBalance(id){
 const a=state.accounts.find(a=>a.id===id);if(!a)return 0;
 let balance=a.opening;
 for(const t of state.transactions)if(t.accountId===id)balance+=(t.type==='income'?1:-1)*t.amount;
 // Keep historical transfers in balances, but users cannot create new transfers.
 for(const t of state.transfers){if(t.fromId===id)balance-=t.amount;if(t.toId===id)balance+=t.amount}
 for(const p of state.cardPayments)if(p.accountId===id)balance-=p.amount;
 for(const x of state.installments)for(const [m,d] of Object.entries(x.paymentDetails||{}))if(paid(x,m)&&d.accountId===id)balance-=due(x,m);
 for(const r of state.investments)if(r.accountId===id)balance-=r.amount;
 return balance;
}
const cashTotal=()=>cashAccounts().reduce((s,a)=>s+accountBalance(a.id),0);
function persist(fn){
 if(blocked){alert('目前資料讀取異常，已停止寫入，避免覆蓋原有紀錄。請先備份或檢查儲存空間。');return false}
 try{const candidate=deep(state);fn(candidate);candidate.updatedAt=new Date().toISOString();if(!validV3(candidate))throw new Error('資料未通過驗證');localStorage.setItem(KEY,JSON.stringify(candidate));state=candidate;saveError=false;render();return true}
 catch(e){saveError=true;renderStatus();alert('自動儲存失敗，資料沒有套用。請確認瀏覽器儲存空間，並先備份。\n'+e.message);return false}
}
function renderStatus(){const e=$('autosave');e.classList.toggle('error',saveError);e.innerHTML=`<i></i>${saveError?'無法儲存':'已自動儲存'}`}
function toast(message){const x=$('toast');x.textContent=message;x.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>x.hidden=true,2900)}
function switchPage(tab){const tabs=['home','accounts','ledger','installments','savings'];if(!tabs.includes(tab))return;page=tab;document.querySelectorAll('.page').forEach(e=>e.classList.toggle('active',e.id==='page-'+tab));document.querySelectorAll('.bottom-nav button').forEach(e=>{e.classList.toggle('active',e.dataset.tab===tab);if(e.dataset.tab===tab)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current')});window.scrollTo({top:0,behavior:'instant'});render()}
function render(){renderHome();renderAccounts();renderLedger();renderInstallments();renderInvesting();renderSavings();renderStatus()}
const reserves=()=>Array.isArray(state.reserves)?state.reserves:[];
const recurringReserves=()=>Array.isArray(state.recurringReserves)?state.recurringReserves:[];
const recurringFor=m=>recurringReserves().filter(r=>r.active&&monthIndex(m)>=monthIndex(r.startMonth)&&!r.skippedMonths.includes(m)).filter(r=>!reserves().some(x=>x.recurringId===r.id&&x.month===m)).map(r=>({id:'recurring:'+r.id,recurringId:r.id,name:r.name,amount:r.amount,month:m,category:r.category,status:'reserved',transactionId:null,virtual:true}));
const monthReserves=m=>[...reserves().filter(r=>r.month===m),...recurringFor(m)];
const reservedFor=m=>monthReserves(m).filter(r=>r.status==='reserved').reduce((sum,r)=>sum+r.amount,0);
function renderReserves(){
 const items=monthReserves(homeMonth).slice().sort((a,b)=>(a.status==='spent')-(b.status==='spent'));
 $('reserve-month-total').textContent=fmt(reservedFor(homeMonth));
 $('reserve-items').innerHTML=items.length?items.map(r=>`<article class="item reserve-item"><div class="item-head"><div><strong class="item-title">${safe(r.name)}</strong><small class="item-sub">${safe(r.category)} · ${r.recurringId?'每月固定預留 · ':''}${r.status==='spent'?'已轉為正式支出':'尚未使用'}</small></div><div class="item-right"><strong class="item-amount">${fmt(r.amount)}</strong></div></div><div class="item-actions">${r.status==='reserved'?`<button type="button" class="small-button" data-action="reserve-spend" data-id="${safe(r.id)}">轉成支出</button>${r.recurringId?`<button type="button" class="small-button" data-action="recurring-edit" data-id="${safe(r.recurringId)}">修改固定預留</button><button type="button" class="small-button" data-action="recurring-skip" data-id="${safe(r.recurringId)}">本月不預留</button>`:`<button type="button" class="small-button" data-action="reserve-edit" data-id="${safe(r.id)}">修改</button><button type="button" class="small-button" data-action="reserve-delete" data-id="${safe(r.id)}">取消預留</button>`}`:'<span class="item-sub">已記帳，不再占用預留額</span>'}${!r.recurringId?`<button type="button" class="small-button" data-action="reserve-copy" data-id="${safe(r.id)}">複製到下月</button>`:''}</div></article>`).join(''):'<div class="empty">本月還沒有預留金，新增後會自動從預估結餘扣除。</div>';
}
function recurringModal(id){
 const old=recurringReserves().find(r=>r.id===id);
 openModal(old?'修改每月固定預留':'新增每月固定預留',`<form id="recurring-form"><div class="form-field"><label>固定預留用途</label><input id="rr-name" required maxlength="80" value="${safe(old?.name||'保險費')}" placeholder="例如：每月保險費"></div><div class="form-row"><div class="form-field"><label>每月金額 NT$</label><input id="rr-amount" type="number" min="1" max="10000000000" step="1" required inputmode="numeric" value="${old?.amount||''}"></div><div class="form-field"><label>開始月份</label><input id="rr-start" type="month" required value="${old?.startMonth||homeMonth}"></div></div><div class="form-field"><label>類別</label><select id="rr-category">${['保險費','健康預留','購物備用','其他預留'].map(x=>option(x,x,old?.category||'保險費')).join('')}</select></div><div class="form-field"><label>狀態</label><select id="rr-active">${option('true','啟用：每月自動預留',String(old?.active??true))}${option('false','暫停：不再自動預留',String(old?.active??true))}</select></div><p class="inline-note">從開始月份起，每月自動列入預估結餘。更改設定不會改動已經轉為正式支出的月份，也不會實際扣款。</p>${actions(old?'儲存固定預留':'新增固定預留')}</form>`,'rr-name');
 $('recurring-form').addEventListener('submit',e=>{e.preventDefault();const name=$('rr-name').value.trim(),amount=currencyInput('rr-amount'),startMonth=$('rr-start').value,category=$('rr-category').value,active=$('rr-active').value==='true';if(!name||!centsInt(amount)||!validMonth(startMonth)||!['保險費','健康預留','購物備用','其他預留'].includes(category)){toast('請確認固定預留資料');return}if(persist(x=>{x.recurringReserves=x.recurringReserves||[];if(old){Object.assign(x.recurringReserves.find(r=>r.id===id),{name,amount,startMonth,category,active})}else x.recurringReserves.push({id:uid(),name,amount,startMonth,category,active,skippedMonths:[]})})){closeModal();toast('每月固定預留已儲存')}});
}
function reserveModal(id){
 const old=reserves().find(r=>r.id===id&&r.status==='reserved');
 openModal(old?'修改預留金':'新增預留金',`<form id="reserve-form"><div class="form-field"><label>預留用途</label><input id="r-name" maxlength="80" required value="${safe(old?.name||'')}" placeholder="例如：預計購物、每月健康費用"></div><div class="form-row"><div class="form-field"><label>預留金額 NT$</label><input id="r-amount" type="number" step="1" min="1" max="10000000000" required inputmode="numeric" value="${old?.amount||''}"></div><div class="form-field"><label>月份</label><input type="month" id="r-month" required value="${old?.month||homeMonth}"></div></div><div class="form-field"><label>類別</label><select id="r-category">${['購物備用','健康預留','其他預留'].map(x=>option(x,x,old?.category||'購物備用')).join('')}</select></div><p class="inline-note">預留金只影響當月預估可用預算，不會立即扣除銀行或現金餘額。實際花費時，請使用「轉成支出」。</p>${actions(old?'儲存修改':'新增預留')}</form>`,'r-name');
 $('reserve-form').addEventListener('submit',e=>{e.preventDefault();const name=$('r-name').value.trim(),amount=currencyInput('r-amount'),month=$('r-month').value,category=$('r-category').value;if(!name||!centsInt(amount)||!validMonth(month)||!['購物備用','健康預留','其他預留'].includes(category)){toast('請確認預留名稱、金額與月份');return}if(persist(x=>{x.reserves=x.reserves||[];if(old)Object.assign(x.reserves.find(r=>r.id===old.id),{name,amount,month,category});else x.reserves.push({id:uid(),name,amount,month,category,status:'reserved',transactionId:null})})){closeModal();toast('已儲存預留金')}});
}
function reserveSpendModal(id){
 const r=monthReserves(homeMonth).find(x=>x.id===id&&x.status==='reserved');if(!r)return;
 openModal('預留金轉成正式支出',`<form id="reserve-spend-form"><div class="help-box">${safe(r.name)} · ${fmt(r.amount)}<br>確認後會解除這筆預留，並新增正式支出；同一筆錢不會重複扣除。</div><div class="form-field"><label>實際花費 NT$</label><input id="rs-amount" type="number" min="1" max="10000000000" step="1" inputmode="numeric" required value="${r.amount}"></div><div class="form-row"><div class="form-field"><label>實際花費日期</label><input id="rs-date" type="date" required value="${today()}"></div><div class="form-field"><label>支付帳戶</label><select id="rs-account">${accountOpts(null)}</select></div></div><p class="inline-note">請選擇實際支付的帳戶；若用信用卡購買，請改由信用卡頁記錄刷卡，並手動取消這筆預留，避免帳目重複。</p>${actions('確認轉成支出')}</form>`);
 $('reserve-spend-form').addEventListener('submit',e=>{e.preventDefault();const amount=currencyInput('rs-amount'),date=$('rs-date').value,accountId=$('rs-account').value||null;if(!centsInt(amount)||!isDate(date)||!(accountId===null||isCashId(accountId))){toast('請確認金額與日期');return}if(persist(x=>{let target=x.reserves.find(z=>z.id===id);if(r.virtual){if(x.reserves.some(z=>z.recurringId===r.recurringId&&z.month===r.month))throw Error('本月已經處理過');target={id:uid(),recurringId:r.recurringId,name:r.name,amount:r.amount,month:r.month,category:r.category,status:'reserved',transactionId:null};x.reserves.push(target)}if(!target||target.status!=='reserved')throw Error('預留狀態已變更');const txId=uid();x.transactions.push({id:txId,type:'expense',amount,date,category:r.category==='購物備用'?'購物':r.category==='健康預留'?'生活':'其他',note:'預留金：'+r.name,accountId});target.status='spent';target.transactionId=txId})){closeModal();toast('已轉成支出，預留金不再重複扣除')}});
}
function renderHome(){
 renderReserves();
 $('home-month').value=homeMonth;
 const salary=txSum(homeMonth,'income','薪資'),expense=txSum(homeMonth,'expense'),install=state.installments.filter(i=>!i.cardId).reduce((s,i)=>s+due(i,homeMonth),0),cardDue=cardAccounts().reduce((sum,c)=>sum+cardBillOutstanding(c.id,homeMonth),0),planned=plannedInvest(homeMonth),reserved=reservedFor(homeMonth),net=salary-install-cardDue-planned-expense-reserved;
 $('home-salary').textContent=fmt(salary);$('home-due').textContent='− '+fmt(install);$('home-card-due').textContent='− '+fmt(cardDue);$('home-invest').textContent='− '+fmt(planned);$('home-reserves').textContent='− '+fmt(reserved);$('home-expenses').textContent='− '+fmt(expense);$('home-projected').textContent=fmt(net);$('home-projected').classList.toggle('negative',net<0);
 $('home-cash').textContent=fmt(cashTotal());
 const cards=cardAccounts();$('home-card-reminder').innerHTML=cards.map(c=>{const bill=cardMonthlySummary(c.id,homeMonth),owed=cardBillOutstanding(c.id,homeMonth);return `<article class="mini-debt"><div class="label-row"><span>${safe(c.name)} · ${safe(homeMonth)}</span><b>本期尚欠 ${fmt(bill.remaining)}</b></div><div class="mini-debt-row">帳單 ${fmt(bill.billed)} · 已繳 ${fmt(bill.paid)} · 截至本月未清 ${fmt(owed)}</div><div class="mini-debt-row">${pendingPaidText(c)?`<strong>${pendingPaidText(c)}</strong>`:''}</div><div class="mini-debt-row">銀行未出帳 ${unbilledText(c)} · 截圖已知待還合計 ${bankKnownDebtText(c)}（不含待入帳款及未確認交易；不重複加分期）</div><button type="button" class="text-btn" data-action="card-detail" data-id="${safe(c.id)}">查看帳單／繳款 ›</button></article>`}).join('');
 $('home-account-preview').innerHTML=cashAccounts().length?cashAccounts().slice(0,4).map(a=>`<div class="account-brief"><span>${safe(a.name)}</span><b>${fmt(accountBalance(a.id))}</b></div>`).join(''):'<div class="empty">尚未建立帳戶</div>';
 const remaining=state.installments.reduce((s,x)=>s+remainingInst(x,homeMonth),0);
 $('home-unpaid').textContent=fmt(remaining);
 $('home-savings-days').textContent=countSaved()+' / 364 天';$('home-savings-amount').textContent=fmt(saved());$('home-savings-goal').textContent='目標 '+fmt(goal());$('home-savings-progress').style.width=percent(saved(),goal())+'%';
}
function renderAccounts(){
 $('accounts-total').textContent=fmt(cashTotal());
 const pending=state.pendingBalanceConfirmation; $('bank-check').innerHTML=pending?`<div class="help-box bank-check"><strong>銀行餘額尚待確認${isMoney(pending.amount)?'：'+fmt(pending.amount):'，請重新查看銀行 App'}</strong><p>${safe(pending.reason||'請核對最新銀行餘額。')} 請選擇實際銀行帳戶，以當下銀行顯示金額校正；不會再扣一次已繳卡費。</p><button type="button" class="small-button" data-action="bank-reconcile">校正目前餘額</button></div>`:'';
 $('accounts-list').innerHTML=cashAccounts().length?cashAccounts().map(a=>`<article class="item"><div class="item-head"><div><strong class="item-title">${safe(a.name)}</strong><small class="item-sub">${accKind(a.kind)}</small></div><div class="item-right"><strong class="item-amount ${accountBalance(a.id)<0?'text-danger':''}">${fmt(accountBalance(a.id))}</strong><small class="item-sub">起始 ${fmt(a.opening)}</small></div></div><div class="item-actions"><button class="small-button" data-action="account-edit" data-id="${safe(a.id)}">編輯帳戶</button><button class="small-button" data-action="tx-account" data-id="${safe(a.id)}">記一筆</button></div></article>`).join(''):'<div class="empty">尚未建立現金或銀行帳戶</div>';
 $('cards-list').innerHTML=cardAccounts().length?cardAccounts().map(c=>{
 const debt=totalCardOutstanding(c.id),month=cardMonthlySummary(c.id,thisMonth());
 const available=cardAvailable(c.id);
 return `<article class="item cc-item"><div class="item-head"><div><strong class="item-title">${safe(c.name)}</strong><small class="item-sub">${safe(c.issuer||'信用卡')} · 結帳 ${c.statementDay} 日／繳款 ${c.dueDay} 日</small></div><div class="item-right"><strong class="item-amount">${fmt(debt)}</strong><small class="item-sub">小金庫已建檔待付（含未到期分期，待核對）</small></div></div><div class="cc-stats"><div><small>本月已繳金額</small><b class="text-good">${fmt(month.paid)}</b></div><div><small>本月剩餘金額</small><b>${fmt(month.remaining)}</b></div><div><small>可用金額（額度）</small><b>${available===null?'未設定':fmt(available)}</b></div></div><div class="cc-overview-meta">${pendingPaidText(c)?safe(pendingPaidText(c)):''}</div><div class="cc-overview-meta">本月帳單 ${fmt(month.billed)}${c.limit!==null&&debt>c.limit?' · 已超出信用額度 '+fmt(debt-c.limit):''}</div><div class="cc-overview-meta">提醒：銀行自動扣繳狀態不會由小金庫更改，變更須向銀行辦理。</div><div class="cc-overview-meta">銀行未出帳 ${unbilledText(c)} · 截圖已知待還合計 ${bankKnownDebtText(c)}（未扣待入帳款）${c.unbilledAsOf?' · '+safe(c.unbilledAsOf):''}</div><div class="cc-overview-meta">${safe(autopayLabel(c))}（僅提醒，不能操作銀行扣款）${c.statementDayConfirmed===false?' · 結帳日待核對':''}</div><div class="item-actions"><button class="small-button" data-action="card-detail" data-id="${safe(c.id)}">帳單／繳款</button><button class="small-button" data-action="card-charge" data-id="${safe(c.id)}">＋ 刷卡</button><button class="small-button" data-action="account-edit" data-id="${safe(c.id)}">編輯</button></div></article>`;
 }).join(''):'<div class="empty">新增信用卡後，可分開管理刷卡金額與繳款</div>';
}

function renderLedger(){
 $('ledger-month').value=ledgerMonth;
 const purchases=state.cardCharges.filter(c=>c.date.startsWith(ledgerMonth));
 $('ledger-income').textContent=fmt(txSum(ledgerMonth,'income'));
 $('ledger-expense').textContent=fmt(txSum(ledgerMonth,'expense')+purchases.reduce((s,c)=>s+c.amount-c.refunded,0));
 const native=state.transactions.filter(x=>x.date.startsWith(ledgerMonth)&&(ledgerFilter==='all'||x.type===ledgerFilter)).map(x=>({...x,cardPurchase:false}));
 const cardTx=(ledgerFilter==='income'?[]:purchases.map(c=>({id:c.id,date:c.date,category:c.category,note:c.note,type:'expense',amount:c.amount-c.refunded,cardPurchase:true,cardId:c.cardId,dueMonth:c.dueMonth})));
 const rows=[...native,...cardTx].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 $('ledger-list').innerHTML=rows.length?rows.map(x=>`<article class="item"><div class="item-head"><div><strong class="item-title">${safe(x.category)}${x.note?' · '+safe(x.note):''}</strong><small class="item-sub">${safe(x.date)} · ${safe(x.cardPurchase?accountName(x.cardId)+'（刷卡，'+x.dueMonth+' 應繳）':accountName(x.accountId))}</small></div><div class="item-right"><strong class="item-amount ${x.type==='income'?'text-good':''}">${x.type==='income'?'+':'−'}${fmt(x.amount)}</strong><button class="text-btn" data-action="${x.cardPurchase?'card-charge-edit':'tx-edit'}" data-id="${safe(x.id)}">修改</button></div></div></article>`).join(''):'<div class="empty">這個月份還沒有符合條件的紀錄</div>';
}

function renderInstallments(){
 $('install-month').value=installMonth;
 const list=state.installments.map(x=>({x,value:due(x,installMonth)})).filter(r=>r.value>0);
 const paidSum=list.reduce((s,r)=>s+paidAmt(r.x,installMonth),0),all=list.reduce((s,r)=>s+r.value,0);
 $('install-due').textContent=fmt(all);$('install-paid').textContent=fmt(paidSum);$('install-waiting').textContent=fmt(all-paidSum);
 $('install-month-items').innerHTML=list.length?list.map(({x,value})=>`<article class="item"><div class="item-head"><div><strong class="item-title">${safe(x.name)}</strong><small class="item-sub">${safe(x.cardId?accountName(x.cardId):(x.card||'未指定信用卡'))} · 第 ${monthIndex(installMonth)-monthIndex(x.startMonth)+1} / ${x.months} 期${x.finxiDueDay?' · 約每月 '+safe(x.finxiDueDay)+' 日':''}</small></div><div class="item-right"><strong class="item-amount">${fmt(value)}</strong><span class="item-sub ${paid(x,installMonth)?'text-good':''}">${remainingInst(x,installMonth)===0?'已繳清':paidAmt(x,installMonth)>0?'部分已繳':'待繳'}</span></div></div><div class="item-actions"><button class="small-button ${paid(x,installMonth)?'danger':''}" data-action="install-pay" data-id="${safe(x.id)}">${remainingInst(x,installMonth)===0?'查看／撤銷繳款':'記錄本期繳款'}</button></div></article>`).join(''):'<div class="empty">這個月份沒有排定的分期</div>';
 $('install-plans').innerHTML=state.installments.length?state.installments.map(x=>{const count=Array.from({length:x.months},(_,i)=>monthFrom(monthIndex(x.startMonth)+i)).filter(m=>paid(x,m)).length,remain=Array.from({length:x.months},(_,i)=>{const m=monthFrom(monthIndex(x.startMonth)+i);return remainingInst(x,m)}).reduce((s,a)=>s+a,0);return `<article class="item"><div class="item-head"><div><strong class="item-title">${safe(x.name)}</strong><small class="item-sub">${x.finxiSourceId?'FINXI 剩餘 '+x.months+' 期':'共 '+x.months+' 期'} · ${safe(x.startMonth)} 起 · ${count} 期已繳${x.finxiOriginalTotal?' · 原金額 '+fmt(x.finxiOriginalTotal):''}</small></div><div class="item-right"><strong class="item-amount">${fmt(remain)}</strong><small class="item-sub">尚未繳清</small></div></div><div class="item-actions"><button class="small-button" data-action="install-edit" data-id="${safe(x.id)}">修改計畫</button></div></article>`}).join(''):'<div class="empty">還沒有分期計畫</div>';
 const pending=Array.isArray(state.finxiNeedsReview)?state.finxiNeedsReview:[];
 $('finxi-unresolved').innerHTML=pending.length?`<div class="help-box"><strong>FINXI 待核對 ${pending.length} 筆</strong><br>來源資料的期數、每期金額與未繳總額不一致，先不列入應繳預算。你可以逐筆修正，確認後才會加入分期。</div>`+pending.map(r=>`<article class="item"><div class="item-head"><div><strong class="item-title">${safe(r.name)}</strong><small class="item-sub">剩餘 ${safe(r.remainingCount)} 期 · 每期 ${fmt(r.paymentAmount)} · 下次 ${safe(r.nextDebitDate)}</small></div><div class="item-right"><strong class="item-amount">${fmt(r.remainingAmount)}</strong><small class="item-sub text-danger">需核對</small></div></div><div class="item-actions"><button type="button" class="small-button" data-action="finxi-review-edit" data-id="${safe(r.id)}">核對／修改</button></div></article>`).join(''):'';
}
function renderInvesting(){
 const p=state.investPlan,m=homeMonth,actual=state.investments.filter(x=>x.date.startsWith(m)).reduce((s,x)=>s+x.amount,0);
 $('invest-monthly').textContent=fmt(p.monthly);$('invest-active').textContent=p.active?'規劃中':'已暫停';$('invest-planned').textContent=fmt(plannedInvest(m));$('invest-actual').textContent=fmt(actual);$('invest-total-cost').textContent=fmt(investCost());$('invest-count').textContent=state.investments.length+' 筆';
 $('investment-list').innerHTML=state.investments.length?[...state.investments].sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<article class="item"><div class="item-head"><div><strong class="item-title">0050 買入${r.note?' · '+safe(r.note):''}</strong><small class="item-sub">${safe(r.date)} · ${safe(accountName(r.accountId))}${r.units?' · '+short(r.units)+' 股':''}</small></div><div class="item-right"><strong class="item-amount">${fmt(r.amount)}</strong><button class="text-btn" data-action="invest-edit" data-id="${safe(r.id)}">修改</button></div></div></article>`).join(''):'<div class="empty">目前只有每月投資規劃，還沒有實際買入紀錄</div>';
}
function renderSavings(){
 $('savings-total').textContent=fmt(saved());$('savings-days').textContent=countSaved()+' / 364 天';$('savings-goal').textContent=fmt(goal());$('savings-percent').textContent=percent(saved(),goal()).toFixed(0)+'%';$('savings-progress').style.width=percent(saved(),goal())+'%';$('savings-complete').hidden=saved()<goal();
 $('week-name').textContent='第 '+(selectedWeek+1)+' 週';$('week-date').textContent=dateFor(selectedWeek*7).slice(5).replace('-','/')+' — '+dateFor(selectedWeek*7+6).slice(5).replace('-','/');$('week-prev').disabled=selectedWeek===0;$('week-next').disabled=selectedWeek===51;
 const amounts=Array.from({length:7},(_,j)=>state.plan.deposits[String(selectedWeek*7+j)]?.amount||0);$('week-total').textContent=fmt(amounts.reduce((a,b)=>a+b,0))+' / '+fmt((selectedWeek+1)*state.plan.step);
 $('days-grid').innerHTML=Array.from({length:7},(_,j)=>{const idx=selectedWeek*7+j,d=state.plan.deposits[String(idx)],date=dateFor(idx);return `<button class="day-cell ${d?'done':''}" data-action="deposit" data-index="${idx}"><span class="day-label">${date.slice(5).replace('-','/')}</span><span class="day-sum">${short(d?.amount||amtDay(idx))}</span><span class="day-check">${d?'✓ 已存':'＋ 存入'}</span></button>`}).join('');
 $('weeks-grid').innerHTML=Array.from({length:52},(_,w)=>{const c=Array.from({length:7},(_,j)=>!!state.plan.deposits[String(w*7+j)]).filter(Boolean).length;return `<button data-action="week" data-index="${w}" class="${w===selectedWeek?'active ':''}${c===7?'done':''}" aria-label="第 ${w+1} 週，已存 ${c} 天">${w+1}</button>`}).join('');
}
function openModal(title,body,focusId){$('modal-title').textContent=title;$('modal-body').innerHTML=body;$('backdrop').hidden=false;document.body.style.overflow='hidden';if(focusId)setTimeout(() => $(focusId)?.focus(),10)}
function closeModal(){$('backdrop').hidden=true;$('modal-body').innerHTML='';document.body.style.overflow=''}
const actions=(submit='儲存')=>`<div class="form-actions"><button type="button" class="cancel" data-action="close">返回</button><button type="submit" class="submit">${submit}</button></div>`;
function accountModal(id){
 const old=state.accounts.find(a=>a.id===id),isCard=old?.kind==='card',title=old?'編輯帳戶':'新增帳戶';
 const opening=old?.opening??0;
 openModal(title,`<form id="account-form"><div class="form-field"><label>帳戶名稱</label><input id="a-name" maxlength="50" required value="${safe(old?.name||'')}" placeholder="例如：永豐信用卡、中國信託"></div><div class="form-field"><label>帳戶類型</label><select id="a-kind" ${old?'disabled':''}>${option('cash','現金／錢包',old?.kind||'cash')}${option('bank','銀行帳戶',old?.kind||'cash')}${option('card','信用卡',old?.kind||'cash')}</select></div><div id="a-cash-fields"><div class="form-field"><label>起始餘額（NT$）</label><input id="a-opening" type="number" inputmode="numeric" min="0" max="10000000000" step="1" required value="${opening}"></div><p class="inline-note">收入增加現金，支出或已確認的卡費繳款才扣除現金。</p></div><div id="a-card-fields" ${isCard?'':'hidden'}><div class="form-field"><label>發卡銀行（可選）</label><input id="a-issuer" maxlength="50" value="${safe(old?.issuer||'')}" placeholder="例如：永豐"></div><div class="form-row"><div class="form-field"><label>結帳日（1–28）</label><input id="a-statement" type="number" min="1" max="28" value="${old?.statementDay||5}" required></div><div class="form-field"><label>繳款日（1–28）</label><input id="a-due" type="number" min="1" max="28" value="${old?.dueDay||20}" required></div></div><div class="form-field"><label>信用額度 NT$（可留空）</label><input id="a-limit" type="number" min="0" step="1" inputmode="numeric" value="${old?.limit??''}" placeholder="不會當成現金"></div><div class="form-field"><label>期初未繳帳款 NT$</label><input id="a-debt" type="number" min="0" step="1" inputmode="numeric" required value="${old?.openingDebt??0}"></div><div class="form-field"><label>期初帳款月份</label><input id="a-debt-month" type="month" value="${old?.openingDebtMonth||thisMonth()}" required></div><div class="form-field"><label>你已繳、銀行畫面尚待確認 NT$</label><input id="a-pending-payment" type="number" min="0" max="10000000000" step="1" inputmode="numeric" value="${old?.pendingPaymentAmount||0}"></div><p class="inline-note">這筆待確認款不會先計入已繳，也不扣銀行餘額；入帳後可在信用卡帳單頁按「已確認銀行入帳」。</p><div class="form-field"><label>銀行 App 顯示的未出帳快照 NT$（可留空）</label><input id="a-unbilled" type="number" min="0" max="10000000000" step="1" inputmode="numeric" value="${old?.unbilledSnapshot??''}" placeholder="例如 12179"></div><div class="form-field"><label>快照核對日</label><input id="a-unbilled-date" type="date" value="${old?.unbilledAsOf||today()}"></div><p class="inline-note">未出帳是銀行畫面上的合計，可能包含已匯入的分期，不會直接再加進欠款或下月應繳，避免重複計算。其他未知消費先保留待補。</p><div class="form-field"><label>預設繳款銀行</label><select id="a-pay-account">${accountOpts(old?.paymentAccountId||'')}</select></div><div class="form-field"><label>銀行自動扣繳狀態（僅作提醒）</label><select id="a-autopay">${option('unknown','尚未確認',old?.autopayMode||'unknown')}${option('full','自動扣繳全額',old?.autopayMode||'unknown')}${option('minimum','自動扣繳最低',old?.autopayMode||'unknown')}${option('off','銀行已確認取消',old?.autopayMode||'unknown')}</select></div><p class="inline-note">更改這裡不會向銀行申請取消自動扣繳；請以銀行實際設定為準。期初帳款避免與已匯入分期重複記錄。</p></div>${actions(old?'儲存修改':'建立帳戶')}</form>${old?'<button id="account-delete" class="block-button danger-line" type="button">刪除此帳戶（無關聯紀錄才可刪）</button>':''}`,'a-name');
 const toggle=()=>{const card=$('a-kind').value==='card';$('a-cash-fields').hidden=card;$('a-card-fields').hidden=!card;$('a-opening').disabled=card;for(const id of ['a-statement','a-due','a-debt','a-debt-month'])$(id).disabled=!card};
 $('a-kind').addEventListener('change',toggle);toggle();
 $('account-form').addEventListener('submit',e=>{e.preventDefault();const name=$('a-name').value.trim(),kind=old?.kind||$('a-kind').value,opening=currencyInput('a-opening');if(!name||(!['cash','bank','card'].includes(kind))||(kind!=='card'&&!isMoney(opening))){toast('請填寫正確的帳戶資料');return}
 const issuer=$('a-issuer').value.trim(),statementDay=currencyInput('a-statement'),dueDay=currencyInput('a-due'),openingDebt=currencyInput('a-debt'),openingDebtMonth=$('a-debt-month').value,limit=$('a-limit').value===''?null:currencyInput('a-limit'),paymentAccountId=$('a-pay-account').value||null,autopayMode=$('a-autopay').value,unbilledSnapshot=$('a-unbilled').value===''?null:currencyInput('a-unbilled'),unbilledAsOf=$('a-unbilled-date').value||null,pendingPaymentAmount=currencyInput('a-pending-payment');
 if(kind==='card'&&(!Number.isSafeInteger(statementDay)||statementDay<1||statementDay>28||!Number.isSafeInteger(dueDay)||dueDay<1||dueDay>28||!isMoney(openingDebt)||!(limit===null||isMoney(limit))||!validMonth(openingDebtMonth)||!(unbilledSnapshot===null||isMoney(unbilledSnapshot))||(unbilledSnapshot!==null&&!isDate(unbilledAsOf))||!isMoney(pendingPaymentAmount))){toast('請確認信用卡設定');return}
 if(kind==='card'&&old&&openingDebt<cardPaymentSum('opening',old.id,null)){toast('期初款小於已付紀錄，不能這樣修改');return}
 if(persist(s=>{const data=kind==='card'?{name,kind,opening:0,issuer,statementDay,dueDay,openingDebt,openingDebtMonth,limit,paymentAccountId,autopayMode,unbilledSnapshot,unbilledAsOf,pendingPaymentAmount,pendingPaymentAsOf:pendingPaymentAmount>0?(old?.pendingPaymentAsOf||today()):null,statementDayConfirmed:old?.statementDay===statementDay?old?.statementDayConfirmed!==false:true}:{name,kind,opening};if(old)Object.assign(s.accounts.find(a=>a.id===id),data);else s.accounts.push({id:uid(),...data})})){closeModal();toast('帳戶已儲存')}});
 if(old)$('account-delete').addEventListener('click',()=>{const used=state.transactions.some(t=>t.accountId===id)||state.transfers.some(t=>t.fromId===id||t.toId===id)||state.investments.some(t=>t.accountId===id)||state.installments.some(t=>t.cardId===id||Object.values(t.paymentDetails||{}).some(p=>p.accountId===id))||state.cardCharges.some(t=>t.cardId===id)||state.cardPayments.some(t=>t.cardId===id||t.accountId===id)||state.accounts.some(a=>a.kind==='card'&&a.paymentAccountId===id);
 if(used){alert('這個帳戶有關聯紀錄，為保護資料不能刪除。可以改名稱或設定。');return}if(!confirm('確定刪除「'+old.name+'」？'))return;if(persist(s=>s.accounts=s.accounts.filter(a=>a.id!==id))){closeModal();toast('帳戶已移除')}});
}

function transactionModal(id,preferredAccount){
 const old=state.transactions.find(t=>t.id===id),cats={income:['薪資','零用錢','獎金','禮金','其他'],expense:['餐飲','交通','購物','學習','娛樂','生活','其他']};
 openModal(old?'修改收支紀錄':'新增收支紀錄',`<form id="tx-form"><div class="form-row"><div class="form-field"><label>收支類型</label><select id="t-type">${option('expense','支出',old?.type||'expense')}${option('income','收入',old?.type||'expense')}</select></div><div class="form-field"><label>金額 NT$</label><input id="t-amount" type="number" inputmode="numeric" min="1" max="10000000000" step="1" required value="${old?.amount||''}" placeholder="例如 150"></div></div><div class="form-row"><div class="form-field"><label>分類</label><select id="t-category"></select></div><div class="form-field"><label>日期</label><input id="t-date" type="date" value="${old?.date||today()}" required></div></div><div class="form-field"><label>使用帳戶</label><select id="t-account">${accountOpts(old?.accountId??preferredAccount??state.accounts[0]?.id)}</select></div><div class="form-field"><label>備註</label><input id="t-note" maxlength="200" placeholder="可留空" value="${safe(old?.note||'')}"></div><p class="inline-note">選擇帳戶後，收入會增加餘額、支出會扣除餘額。分期付款請到分期頁面記錄，避免重複。</p>${actions(old?'儲存修改':'儲存記帳')}</form>${old?'<button id="t-delete" type="button" class="block-button danger-line">刪除此筆紀錄（不影響其他紀錄）</button>':''}`,'t-amount');
 const fill=()=>{const v=$('t-type').value;$('t-category').innerHTML=cats[v].map(c=>option(c,c,old?.category===c?c:cats[v][0])).join('');if(old?.category&&!cats[v].includes(old.category))$('t-category').innerHTML+=option(old.category,old.category,old.category)};
 $('t-type').addEventListener('change',fill);fill();
 $('tx-form').addEventListener('submit',e=>{e.preventDefault();const type=$('t-type').value,amount=currencyInput('t-amount'),date=$('t-date').value,category=$('t-category').value,accountId=$('t-account').value||null,note=$('t-note').value.trim();if(!centsInt(amount)||!isDate(date)||!category){toast('請確認金額與日期');return}if(persist(s=>{const t={id:old?.id||uid(),type,amount,date,category,note,accountId,createdAt:old?.createdAt||new Date().toISOString()};if(old)Object.assign(s.transactions.find(x=>x.id===id),t);else s.transactions.push(t)})){closeModal();toast('記帳已自動儲存')}});
 if(old)$('t-delete').addEventListener('click',()=>{if(confirm('只刪除這一筆記帳？'))if(persist(s=>s.transactions=s.transactions.filter(t=>t.id!==id))){closeModal();toast('已撤銷這筆記帳')}});
}

function installmentModal(id){
 const old=state.installments.find(x=>x.id===id);
 openModal(old?'修改分期計畫':'新增刷卡分期',`<form id="inst-form"><div class="form-field"><label>商品或購買名稱</label><input id="i-name" required maxlength="80" value="${safe(old?.name||'')}" placeholder="例如：手機、電腦"></div><div class="form-row"><div class="form-field"><label>總價（含手續費）NT$</label><input id="i-total" type="number" inputmode="numeric" min="1" step="1" required value="${old?.total||''}"></div><div class="form-field"><label>分期期數</label><input id="i-months" type="number" inputmode="numeric" min="1" max="120" step="1" required value="${old?.months||6}"></div></div><div class="form-row"><div class="form-field"><label>首期月份</label><input id="i-start" type="month" required value="${old?.startMonth||thisMonth()}"></div><div class="form-field"><label>所屬信用卡</label><select id="i-card">${cardOpts(old?.cardId||cardAccounts().find(c=>c.name===(old?.card||''))?.id||'')}</select></div></div><div class="help-box" id="inst-preview">每期金額會在儲存時自動計算。</div>${actions(old?'儲存修改':'建立分期')}</form>${old?'<button id="inst-delete" type="button" class="block-button danger-line">刪除這個分期計畫</button>':''}`,'i-name');
 const preview=()=>{const total=currencyInput('i-total'),months=currencyInput('i-months');$('inst-preview').textContent=centsInt(total)&&Number.isSafeInteger(months)&&months>0&&total>=months?'前 '+(months-1)+' 期每月 '+fmt(Math.floor(total/months))+'；末期 '+fmt(Math.floor(total/months)+total%months):'輸入總價和期數，預覽每期金額'};
 $('i-total').addEventListener('input',preview);$('i-months').addEventListener('input',preview);preview();
 $('inst-form').addEventListener('submit',e=>{e.preventDefault();const name=$('i-name').value.trim(),total=currencyInput('i-total'),months=currencyInput('i-months'),startMonth=$('i-start').value,cardId=$('i-card').value||null;if(!name||!centsInt(total)||!Number.isSafeInteger(months)||months<1||months>120||total<months||!validMonth(startMonth)){toast('請填寫正確分期資料');return}if(old&&state.cardPayments.some(p=>p.sourceType==='installment'&&p.sourceId===id)&&(old.cardId!==cardId||old.total!==total||old.months!==months||old.startMonth!==startMonth)){toast('有信用卡繳款紀錄時不能更換所屬信用卡，請先撤銷繳款');return}if(old&&old.paidMonths.some(m=>monthIndex(m)<monthIndex(startMonth)||monthIndex(m)>=monthIndex(startMonth)+months)){toast('已有繳款紀錄不在新期數內，請先撤銷該期繳款');return}if(persist(s=>{const p={id:old?.id||uid(),name,total,months,startMonth,cardId,card:cardId?accountById(cardId)?.name||'信用卡':(old?.card||''),paidMonths:old?[...old.paidMonths]:[],paymentDetails:old?deep(old.paymentDetails):{}};if(old)Object.assign(s.installments.find(x=>x.id===id),p);else s.installments.push(p)})){closeModal();toast('分期計畫已儲存')}});
 if(old)$('inst-delete').addEventListener('click',()=>{if(state.cardPayments.some(p=>p.sourceType==='installment'&&p.sourceId===id)){toast('已有信用卡繳款紀錄，請先撤銷繳款才可刪除');return}if(!confirm('刪除這個分期計畫和它的繳款標記？已扣除的指定帳戶金額也會還原，無關的紀錄會保留。'))return;if(persist(s=>s.installments=s.installments.filter(x=>x.id!==id))){closeModal();toast('分期計畫已移除')}});
}
// Review a FINXI conflict without touching other installments or live account balances.
function finxiReviewModal(sourceId){
 const r=(Array.isArray(state.finxiNeedsReview)?state.finxiNeedsReview:[]).find(x=>x.id===sourceId);
 if(!r){toast('找不到這筆待核對資料，請重新開啟分期頁面');return}
 const installmentId='finxi:'+r.id;
 if(state.installments.some(x=>x.id===installmentId)){
  toast('這筆已在分期計畫中，不會重複新增');return;
 }
 const rem=Number(r.remainingAmount),months=Number(r.remainingCount),per=Number(r.paymentAmount),date=isDate(r.nextDebitDate)?r.nextDebitDate:today();
 const suggested=centsInt(rem)&&centsInt(per)&&rem%per===0&&rem/per<=120?rem/per:null;
 const choiceNote=suggested&&suggested!==months?`<div class="help-box finxi-tip"><strong>有一種可能：</strong>${fmt(rem)} ÷ ${fmt(per)} = ${suggested} 期。如果銀行帳單確認只剩 ${suggested} 期，可點下方按鈕帶入；這不是自動修正。</div>`:'';
 const cardId=cardAccounts().find(c=>c.name===r.sourceCard||c.issuer===r.sourceCard)?.id||null;
 openModal('核對 FINXI 分期',`<div class="help-box">請以信用卡帳單或原始紀錄為準。只有按「確認加入分期」才會計入每月應繳，已繳歷史不會重新扣款。<br>FINXI 原資料：${safe(r.remainingCount)} 期 × ${fmt(r.paymentAmount)}，剩餘 ${fmt(r.remainingAmount)}。</div>${choiceNote}<form id="finxi-review-form"><div class="form-field"><label>分期名稱</label><input id="fr-name" maxlength="80" required value="${safe(r.name)}"></div><div class="form-row"><div class="form-field"><label>剩餘應繳總額 NT$</label><input id="fr-total" type="number" inputmode="numeric" min="1" max="10000000000" step="1" required value="${Number.isSafeInteger(rem)?rem:''}"></div><div class="form-field"><label>剩餘期數</label><input id="fr-months" type="number" inputmode="numeric" min="1" max="120" step="1" required value="${Number.isSafeInteger(months)?months:''}"></div></div><div class="form-row"><div class="form-field"><label>每期金額 NT$</label><input id="fr-monthly" type="number" inputmode="numeric" min="1" max="10000000000" step="1" required value="${Number.isSafeInteger(per)?per:''}"></div><div class="form-field"><label>下期月份</label><input id="fr-start" type="month" required value="${date.slice(0,7)}"></div></div><div class="form-field"><label>對應信用卡</label><select id="fr-card">${cardOpts(cardId)}</select></div><div class="help-box" id="fr-preview" aria-live="polite"></div>${suggested&&suggested!==months?`<button type="button" id="fr-use-suggested" class="block-button">依剩餘總額改成 ${suggested} 期（請先核對）</button>`:''}<p class="inline-note">目前分期計畫會將總額平均分配到每期，因此這三個數字必須相符。若信用卡末期金額不同，請依實際帳單重新確認。沒有指定信用卡時，也不會自動扣除銀行餘額。</p>${actions('確認加入分期')}</form>`,'fr-months');
 const preview=()=>{
  const total=currencyInput('fr-total'),count=currencyInput('fr-months'),monthly=currencyInput('fr-monthly');
  const valid=centsInt(total)&&Number.isSafeInteger(count)&&count>=1&&count<=120&&centsInt(monthly)&&monthly*count===total;
  $('fr-preview').classList.toggle('finxi-invalid',!valid);
  $('fr-preview').innerHTML=valid?`<strong class="text-good">金額相符，可以加入</strong><br>每月 ${fmt(monthly)} × ${count} 期 = ${fmt(total)}。儲存後才開始列入應繳。`:`<strong class="text-danger">金額尚未相符</strong><br>目前 ${count||0} 期 × ${fmt(monthly)} = ${fmt((count||0)*(monthly||0))}，與剩餘 ${fmt(total)} 不同。請核對後修改。`;
 };
 ['fr-total','fr-months','fr-monthly'].forEach(id=>$(id).addEventListener('input',preview));
 $('fr-use-suggested')?.addEventListener('click',()=>{$('fr-months').value=String(suggested);preview()});
 preview();
 $('finxi-review-form').addEventListener('submit',e=>{
  e.preventDefault();
  const name=$('fr-name').value.trim(),total=currencyInput('fr-total'),count=currencyInput('fr-months'),monthly=currencyInput('fr-monthly'),startMonth=$('fr-start').value,cardId=$('fr-card').value||null;
  if(!name||name.length>80||!centsInt(total)||!Number.isSafeInteger(count)||count<1||count>120||total<count||!centsInt(monthly)||monthly*count!==total||!validMonth(startMonth)||!(cardId===null||isCardId(cardId))){toast('資料還沒核對完成，請確認期數和金額');preview();return}
  if(state.installments.some(x=>x.id===installmentId)){toast('這筆已加入過，請勿重複匯入');return}
  if(persist(s=>{
   if(s.installments.some(x=>x.id===installmentId))throw new Error('分期已存在');
   const item={id:installmentId,name,total,months:count,startMonth,cardId,card:cardId?accountName(cardId):r.sourceCard||'',paidMonths:[],paymentDetails:{},finxiSourceId:r.id,finxiOriginalTotal:r.originalTotal||null,finxiDueDay:Number(date.slice(8,10)),finxiImportedAt:today(),finxiManuallyReviewed:true};
   s.installments.push(item);
   s.finxiNeedsReview=(s.finxiNeedsReview||[]).filter(x=>x.id!==r.id);
  })){
   closeModal();installMonth=startMonth;switchPage('installments');toast('已加入分期；不會立即扣銀行帳戶');
  }
 });
}
function paymentModal(id){
 const x=state.installments.find(x=>x.id===id),m=installMonth;if(!x||!due(x,m))return;
 const p=state.cardPayments.filter(p=>p.sourceType==='installment'&&p.sourceId===id&&p.sourceMonth===m);
 const legacy=legacyPaid(x,m),outstanding=remainingInst(x,m);
 if(legacy){openModal('撤銷本期繳款',`<div class="help-box">${safe(x.name)} · ${safe(m)}<p>撤銷這一期，其他分期不變；原扣款帳戶也會還原。</p></div><div class="form-actions"><button type="button" class="cancel" data-action="close">返回</button><button type="button" class="submit" id="undo-payment">確認撤銷</button></div>`);$('undo-payment').addEventListener('click',()=>{if(persist(s=>{const a=s.installments.find(z=>z.id===id);a.paidMonths=a.paidMonths.filter(z=>z!==m);delete a.paymentDetails[m]})){closeModal();toast('只撤銷了這一期')}});return}
 if(p.length){openModal('本期繳款紀錄',`<div class="help-box">${safe(x.name)} · ${safe(m)}<br>本期 ${fmt(due(x,m))}，已繳 ${fmt(paidAmt(x,m))}，剩餘 ${fmt(outstanding)}</div>${p.map(y=>`<div class="item"><div class="item-head"><div><strong class="item-title">${fmt(y.amount)}</strong><small class="item-sub">${safe(y.date)} · ${safe(accountName(y.accountId))}</small></div><button class="small-button danger" data-action="card-payment-undo" data-id="${safe(y.groupId)}">撤銷這筆</button></div></div>`).join('')}${outstanding>0?'<button id="install-continue" class="primary-button">繼續記錄繳款</button>':''}`);$('install-continue')?.addEventListener('click',()=>{closeModal();installmentPayForm(x,m)});return}
 if(outstanding>0)installmentPayForm(x,m);
}
function installmentPayForm(x,m){
 const outstanding=remainingInst(x,m);
 if(x.cardId){
  const card=accountById(x.cardId);
  openModal('信用卡分期繳款',`<form id="inst-card-pay"><div class="help-box">${safe(card.name)} · ${safe(x.name)}<br>本期剩餘 ${fmt(outstanding)}</div><div class="form-row"><div class="form-field"><label>本次實繳 NT$</label><input id="inst-pay-amount" type="number" inputmode="numeric" min="1" max="${outstanding}" step="1" value="${outstanding}" required></div><div class="form-field"><label>繳款日期</label><input id="inst-pay-date" type="date" value="${today()}" required></div></div><div class="form-field"><label>從哪個現金／銀行帳戶繳款</label><select id="inst-pay-account">${accountOpts(card.paymentAccountId)}</select></div><p class="inline-note">可以部分繳款。每筆只扣一次現金帳戶，並降低這期信用卡欠款；可以個別撤銷。</p>${actions('記錄繳款')}</form>`);
  $('inst-card-pay').addEventListener('submit',e=>{e.preventDefault();const amount=currencyInput('inst-pay-amount'),date=$('inst-pay-date').value,accountId=$('inst-pay-account').value||null;if(!centsInt(amount)||amount>remainingInst(x,m)||!isDate(date)){toast('繳款金額或日期有誤');return}if(persist(s=>s.cardPayments.push({id:uid(),groupId:uid(),cardId:x.cardId,sourceType:'installment',sourceId:x.id,sourceMonth:m,amount,date,accountId}))){closeModal();toast('本期繳款已儲存')}});
 }else{
  openModal('確認本期已繳',`<form id="payment-form"><div class="help-box">${safe(x.name)} · ${safe(m)}<br>本次應繳 <strong>${fmt(outstanding)}</strong></div><div class="form-field"><label>從哪個帳戶扣款？</label><select id="payment-account">${accountOpts(cashAccounts().find(a=>a.kind==='bank')?.id||'')}</select></div><p class="inline-note">此分期尚未指定信用卡，因此沿用舊版一次標記整期繳清的方式。你可以先去「修改計畫」綁定信用卡。</p>${actions('標記為已繳')}</form>`);
  $('payment-form').addEventListener('submit',e=>{e.preventDefault();const accountId=$('payment-account').value||null;if(persist(s=>{const z=s.installments.find(z=>z.id===x.id);if(!z.paidMonths.includes(m))z.paidMonths.push(m);z.paymentDetails[m]={accountId,date:today()}})){closeModal();toast('本期已繳，可單獨撤銷')}});
 }
}

function investmentSettings(){const p=state.investPlan;openModal('0050 定期定額設定',`<form id="inv-settings-form"><div class="form-field"><label>標的</label><input value="0050 · 元大台灣50" disabled></div><div class="form-row"><div class="form-field"><label>每月計畫投入 NT$</label><input id="inv-amount" type="number" inputmode="numeric" min="0" step="1" required value="${p.monthly}"></div><div class="form-field"><label>計畫起始月份</label><input id="inv-start" type="month" value="${p.startMonth}"></div></div><div class="form-field"><label>定期定額狀態</label><select id="inv-active">${option('true','啟用預算預留',String(p.active))}${option('false','暫停預算預留',String(p.active))}</select></div><p class="inline-note">修改只是預算設定，不會向銀行或券商送出任何交易。以前的買入紀錄保持不變。</p>${actions()}</form>`,'inv-amount');$('inv-settings-form').addEventListener('submit',e=>{e.preventDefault();const monthly=currencyInput('inv-amount'),startMonth=$('inv-start').value,active=$('inv-active').value==='true';if(!isMoney(monthly)||!validMonth(startMonth)){toast('請填正確的金額與月份');return}if(persist(s=>Object.assign(s.investPlan,{monthly,startMonth,active}))){closeModal();toast('每月投資預算已更新')}})}
function investmentRecordModal(id){
 const old=state.investments.find(x=>x.id===id);
 openModal(old?'編輯 0050 買入紀錄':'記錄 0050 買入',`<form id="inv-record-form"><div class="form-row"><div class="form-field"><label>實際投入金額 NT$</label><input id="ir-amount" type="number" inputmode="numeric" min="1" step="1" value="${old?.amount||state.investPlan.monthly||1000}" required></div><div class="form-field"><label>實際買入日期</label><input id="ir-date" type="date" value="${old?.date||today()}" required></div></div><div class="form-field"><label>扣款帳戶</label><select id="ir-account">${accountOpts(old?.accountId??state.accounts.find(a=>a.kind==='bank')?.id??'')}</select></div><div class="form-row"><div class="form-field"><label>成交股數（選填）</label><input id="ir-units" type="number" inputmode="decimal" min="0" step="any" value="${old?.units||''}" placeholder="例如 15.5"></div><div class="form-field"><label>備註</label><input id="ir-note" maxlength="200" value="${safe(old?.note||'')}"></div></div><p class="inline-note">只在確定已經買入時建立紀錄；選擇扣款帳戶會扣除現金，但不會真的下單。這裡追蹤投入成本，不會把 ETF 當現金或推估市值。</p>${actions(old?'儲存修改':'確認已買入')}</form>${old?'<button id="inv-delete" type="button" class="block-button danger-line">取消這筆買入紀錄</button>':''}`,'ir-amount');
 $('inv-record-form').addEventListener('submit',e=>{e.preventDefault();const amount=currencyInput('ir-amount'),date=$('ir-date').value,accountId=$('ir-account').value||null,units=$('ir-units').value===''?0:Number($('ir-units').value),note=$('ir-note').value.trim();if(!centsInt(amount)||!isDate(date)||!Number.isFinite(units)||units<0){toast('請確認買入金額和日期');return}if(persist(s=>{const r={id:old?.id||uid(),amount,date,accountId,units,note};if(old)Object.assign(s.investments.find(x=>x.id===id),r);else s.investments.push(r)})){closeModal();toast('0050 買入紀錄已儲存')}});
 if(old)$('inv-delete').addEventListener('click',()=>{if(!confirm('只取消這一筆買入紀錄？指定帳戶的扣款會還原。'))return;if(persist(s=>s.investments=s.investments.filter(x=>x.id!==id))){closeModal();toast('已取消該筆買入紀錄')}});
}
function savingsSettings(){openModal('52 週存錢設定',`<form id="savings-form"><div class="form-row"><div class="form-field"><label>開始日期</label><input id="sav-start" type="date" required value="${state.plan.startDate}"></div><div class="form-field"><label>每週遞增 NT$</label><input id="sav-step" type="number" min="7" max="1000000" step="1" inputmode="numeric" required value="${state.plan.step}"></div></div><div class="help-box">52 週目標總額：<strong id="sav-preview">${fmt(goal())}</strong><br>第 1 週存入遞增額，第 52 週存入 52 倍；每週平均分成七天。</div><p class="inline-note">調整日期與目標不會刪除任何已存的格子，原本每日存入的金額會保留。</p>${actions()}</form>`);$('sav-step').addEventListener('input',()=>{$('sav-preview').textContent=fmt(Number($('sav-step').value)*1378)});$('savings-form').addEventListener('submit',e=>{e.preventDefault();const startDate=$('sav-start').value,step=currencyInput('sav-step');if(!isDate(startDate)||!Number.isSafeInteger(step)||step<7||step>1000000){toast('請填寫正確設定');return}if(persist(s=>{s.plan.startDate=startDate;s.plan.step=step})){selectedWeek=currentWeek();closeModal();render();toast('計畫已更新，已存紀錄保留')}})}
function depositModal(idx){const k=String(idx),old=state.plan.deposits[k];openModal(old?'修改這一天的存款':'存入今天一筆',`<form id="deposit-form"><div class="help-box">第 ${Math.floor(idx/7)+1} 週 · ${safe(dateFor(idx))}<br>${old?'原本已存 '+fmt(old.amount):'建議存入 '+fmt(amtDay(idx))}</div><div class="form-field"><label>這一天要記錄多少存款？</label><input id="deposit-amount" type="number" inputmode="numeric" min="1" max="10000000000" step="1" required value="${old?.amount||amtDay(idx)}"></div><p class="inline-note">只更新這一天的進度，不會修改其他日期，也不會從銀行自動轉帳。</p>${actions(old?'儲存修改':'存入')}</form>${old?'<button id="deposit-cancel" class="block-button danger-line" type="button">只取消這一天的存入</button>':''}`,'deposit-amount');
 $('deposit-form').addEventListener('submit',e=>{e.preventDefault();const amount=currencyInput('deposit-amount');if(!centsInt(amount)){toast('請輸入正確金額');return}const prior=old?deep(old):null;if(persist(s=>s.plan.deposits[k]={amount,savedAt:new Date().toISOString()})){const delta=amount-(prior?.amount||0);encouragement(k,prior,amount,delta)}});
 if(old)$('deposit-cancel').addEventListener('click',()=>{if(!confirm('只取消 '+dateFor(idx)+' 這一天的存入？其餘 363 格和計畫完全不變。'))return;if(persist(s=>delete s.plan.deposits[k])){closeModal();toast('只撤銷了這一天的存款')}});
}
function encouragement(k,prior,amount,delta){const after=saved(),complete=after>=goal();openModal(complete?'52 週目標達成 ★':'又更接近目標了 ✦',`<div class="help-box success-box"><strong>${complete?'你的存錢目標已達成！':'每一筆都有意義。'}</strong><br>這一天已記錄 ${fmt(amount)}。<br>${delta>=0?'比修改前多存 '+fmt(delta):'本次調整減少 '+fmt(-delta)}。<br>累積 ${fmt(after)}，距離年度金額目標還差 ${fmt(Math.max(0,goal()-after))}。</div>${complete?'<p class="center">✦　◈　↗　✧<br>讓財富自由，從每一天的選擇開始 ★</p>':''}<button id="undo-deposit" class="block-button danger-line" type="button">↶ 撤銷剛才這一筆</button><button id="done-deposit" class="primary-button" type="button">完成</button>`);
 const recorded=state.plan.deposits[k]?.savedAt;
 $('undo-deposit').addEventListener('click',()=>{const latest=state.plan.deposits[k];if(!latest||latest.savedAt!==recorded){toast('資料已改變，請返回日期格子再確認');return}if(persist(s=>{if(prior)s.plan.deposits[k]=prior;else delete s.plan.deposits[k]})){closeModal();toast('剛才那一筆已撤銷，其他日期完全保留')}});
 $('done-deposit').addEventListener('click',closeModal);
}
function chargeModal(id,preferredCard){
 const old=state.cardCharges.find(c=>c.id===id),cards=cardAccounts();if(!cards.length){toast('請先到帳戶新增一張信用卡');switchPage('accounts');return}
 const cardId=old?.cardId||preferredCard||cards[0].id;
 const autoDue=cardDueMonth(accountById(cardId),old?.date||today());
 openModal(old?'修改刷卡紀錄':'新增信用卡消費',`<form id="charge-form"><div class="form-field"><label>信用卡</label><select id="ch-card">${cardOpts(cardId,false)}</select></div><div class="form-row"><div class="form-field"><label>刷卡金額 NT$</label><input id="ch-amount" inputmode="numeric" type="number" min="1" step="1" required value="${old?.amount||''}"></div><div class="form-field"><label>刷卡日期</label><input id="ch-date" type="date" required value="${old?.date||today()}"></div></div><div class="form-row"><div class="form-field"><label>分類</label><select id="ch-category">${['購物','餐飲','交通','生活','娛樂','學習','其他'].map(x=>option(x,x,old?.category||'購物')).join('')}</select></div><div class="form-field"><label>帳單應繳月份</label><input id="ch-due" type="month" required value="${old?.dueMonth||autoDue}"></div></div><div class="form-field"><label>備註</label><input id="ch-note" maxlength="200" value="${safe(old?.note||'')}" placeholder="商品名稱（可留空）"></div><p class="inline-note">刷卡只增加信用卡未繳款，不會立即扣銀行存款。依結帳日推算應繳月份，可自行修正。</p>${actions(old?'儲存修改':'加入刷卡')}</form>${old?`<button id="charge-refund" type="button" class="block-button">記錄退款／取消</button><button id="charge-delete" type="button" class="block-button danger-line">刪除這筆刷卡</button>`:''}`,'ch-amount');
 const recalc=()=>{$('ch-due').value=cardDueMonth(accountById($('ch-card').value),$('ch-date').value)};
 $('ch-card').addEventListener('change',recalc);$('ch-date').addEventListener('change',recalc);
 $('charge-form').addEventListener('submit',e=>{e.preventDefault();const cardId=$('ch-card').value,amount=currencyInput('ch-amount'),date=$('ch-date').value,category=$('ch-category').value,dueMonth=$('ch-due').value,note=$('ch-note').value.trim();if(!isCardId(cardId)||!centsInt(amount)||!isDate(date)||!validMonth(dueMonth)){toast('請檢查刷卡金額與日期');return}
 if(old&&(old.cardId!==cardId||amount<old.refunded+cardPaymentSum('charge',old.id,null))){toast('這筆刷卡已關聯退款或繳款，無法這樣更改');return}
 if(persist(s=>{const data={id:old?.id||uid(),cardId,amount,date,category,dueMonth,note,refunded:old?.refunded||0};if(old)Object.assign(s.cardCharges.find(c=>c.id===id),data);else s.cardCharges.push(data)})){closeModal();toast('刷卡紀錄已儲存')}});
 if(old){$('charge-delete').addEventListener('click',()=>{if(cardPaymentSum('charge',id,null)){toast('這筆已繳過卡費，請先撤銷繳款才能刪除');return}if(!confirm('只刪除這筆刷卡紀錄？'))return;if(persist(s=>s.cardCharges=s.cardCharges.filter(c=>c.id!==id))){closeModal();toast('這筆刷卡已刪除')}});
 $('charge-refund').addEventListener('click',()=>refundModal(id));}
}
function refundModal(id){const c=state.cardCharges.find(c=>c.id===id);if(!c)return;const cap=cardChargeRemaining(c);if(cap===0){toast('這筆已無可退款餘額；如已繳費，先撤銷對應繳款紀錄');return}
 openModal('信用卡退款／取消',`<form id="refund-form"><div class="help-box">${safe(c.note||c.category)} · 原刷卡 ${fmt(c.amount)}<br>本次可退款最多 ${fmt(cap)}（限尚未繳款部分）</div><div class="form-field"><label>本次退款金額 NT$</label><input id="rf-amount" type="number" min="1" max="${cap}" step="1" value="${cap}" required></div><p class="inline-note">退款減少這筆信用卡未清款，不會把錢直接加到銀行帳戶。</p>${actions('確認退款')}</form>`);
 $('refund-form').addEventListener('submit',e=>{e.preventDefault();const amount=currencyInput('rf-amount');if(!centsInt(amount)||amount>cardChargeRemaining(c)){toast('退款金額有誤');return}if(persist(s=>s.cardCharges.find(z=>z.id===id).refunded+=amount)){closeModal();toast('退款已記錄')}})
}
let cardMonth=thisMonth();
function cardDetail(id){const c=accountById(id);if(!c||c.kind!=='card')return;
 const dueNow=cardBillOutstanding(id,cardMonth),debt=totalCardOutstanding(id),summary=cardMonthlySummary(id,cardMonth),available=cardAvailable(id);
 const chargeRows=state.cardCharges.filter(x=>x.cardId===id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,80);
 const payGroups=Object.values(state.cardPayments.filter(x=>x.cardId===id).reduce((o,p)=>{const k=p.groupId;const rec=o[k]||(o[k]={id:k,total:0,date:p.date,dateEstimated:!!p.dateEstimated,account:p.accountId,count:0});rec.total+=p.amount;rec.count++;return o},{})).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,40);
 openModal(safe(c.name),`<div class="form-field"><label>查看帳單月份</label><input id="cc-month" type="month" value="${cardMonth}"></div><div class="cc-bill-label">${safe(cardMonth)} · 信用卡帳單</div><div class="cc-totals"><div><small>本月應繳</small><b>${fmt(summary.billed)}</b></div><div><small>已繳金額</small><b class="text-good">${fmt(summary.paid)}</b></div><div><small>剩餘金額</small><b>${fmt(summary.remaining)}</b></div><div><small>可用金額（額度）</small><b>${available===null?'未設定':fmt(available)}</b></div></div><div class="cc-detail-foot"><span>截至本月仍待繳（含逾期）</span><b>${fmt(dueNow)}</b></div><div class="cc-detail-foot"><span>小金庫已建檔待付款（含未到期分期，非銀行實際總欠款）</span><b>${fmt(debt)}</b></div><div class="cc-detail-foot"><span>你剛繳、待銀行確認</span><b>${fmt(c.pendingPaymentAmount||0)}</b></div>${c.pendingPaymentAmount>0?`<button class="block-button" id="cc-confirm-pending">已確認銀行入帳：補登 ${fmt(c.pendingPaymentAmount)}</button>`:''}<div class="cc-detail-foot"><span>銀行未出帳快照（待核對）</span><b>${unbilledText(c)}</b></div><div class="cc-detail-foot"><span>截圖已知待還合計（未扣待入帳款）</span><b>${bankKnownDebtText(c)}</b></div><p class="cc-muted">上面「小金庫已建檔待付款」包含所有匯入分期的剩餘期數，尚未逐筆核對銀行帳單，不可當作銀行實際欠款；銀行未出帳快照可能與分期重疊，沒有再加到建檔分期。截圖已知待還合計只加「本期尚欠＋未出帳快照」，不代表下期應繳，亦不包含其他待入帳消費、費用或利息。</p><p class="cc-muted">已繳與剩餘按帳單月份計算；可用金額為信用額度扣掉全部未清帳款，並不是銀行存款。${c.limit===null?'請先在「編輯信用卡」設定信用額度。':''}</p><button id="cc-pay" class="primary-button">記錄信用卡帳單繳款</button><button id="cc-new" class="block-button">＋ 新增刷卡</button><h3 class="cc-section">刷卡紀錄</h3><div class="cc-list">${chargeRows.length?chargeRows.map(x=>`<div class="cc-line"><div class="cc-row"><div><strong>${safe(x.note||x.category)}</strong><div><small>${safe(x.date)} · ${safe(x.dueMonth)} 應繳</small></div></div><strong>${fmt(x.amount-x.refunded)}</strong></div><div class="cc-actions"><button class="small-button" data-action="card-charge-edit" data-id="${safe(x.id)}">修改／退款</button></div></div>`).join(''):'<div class="empty">還沒有刷卡紀錄</div>'}</div><h3 class="cc-section">已記錄繳款</h3><div class="cc-list">${payGroups.length?payGroups.map(g=>`<div class="cc-line"><div class="cc-row"><div><strong>${fmt(g.total)}</strong><div><small>${safe(g.date)}${g.dateEstimated?'（補登日期待核對）':''} · ${safe(accountName(g.account))} · ${g.count} 項</small></div></div><button class="small-button danger" data-action="card-payment-undo" data-id="${safe(g.id)}">撤銷</button></div></div>`).join(''):'<div class="empty">尚未記錄信用卡繳款</div>'}</div>`);
 $('cc-month').addEventListener('change',e=>{if(validMonth(e.target.value)){cardMonth=e.target.value;cardDetail(id)}});
 $('cc-pay').addEventListener('click',()=>cardBillPaymentModal(id));$('cc-new').addEventListener('click',()=>chargeModal(undefined,id));if($('cc-confirm-pending'))$('cc-confirm-pending').addEventListener('click',()=>confirmPendingCardPayment(id));
}

function confirmPendingCardPayment(id){
 const c=accountById(id);if(!c||c.kind!=='card'||!c.pendingPaymentAmount)return;
 const amount=c.pendingPaymentAmount,month=c.openingDebtMonth,parts=cardComponents(id,month);
 if(amount>parts.reduce((sum,r)=>sum+r.remaining,0)){toast('待確認款大於剩餘卡費，請核對銀行');return}
 if(!confirm(`請先確認銀行 App 或繳款紀錄顯示這筆 ${fmt(amount)} 已經入帳。\n這是先前已支付的歷史款項，不會再扣現在的銀行餘額。確認補登嗎？`))return;
 const groupId=uid(),date=isDate(c.pendingPaymentAsOf)?c.pendingPaymentAsOf:today();
 if(persist(d=>{let remaining=amount;for(const row of parts){if(remaining<=0)break;const value=Math.min(row.remaining,remaining);d.cardPayments.push({id:uid(),groupId,cardId:id,accountId:null,date,dateEstimated:true,amount:value,sourceType:row.type,sourceId:row.id,sourceMonth:row.type==='installment'?row.month:null});remaining-=value}const a=d.accounts.find(x=>x.id===id);a.pendingPaymentAmount=0;a.pendingPaymentAsOf=null;})){toast('已補登確認入帳款，不會再次扣銀行');cardDetail(id)}
}

function cardBillPaymentModal(id){const c=accountById(id),parts=cardComponents(id,cardMonth),total=parts.reduce((s,x)=>s+x.remaining,0);if(total<=0){toast('截至選定月份沒有待繳帳款');return}
 const summary=cardMonthlySummary(id,cardMonth),available=cardAvailable(id);
 openModal('記錄信用卡繳款',`<form id="card-bill-form"><div class="cc-bill-label">${safe(c.name)} · ${safe(cardMonth)} 帳單</div><div class="cc-totals cc-pay-stats"><div><small>已繳金額（本月帳單）</small><b class="text-good">${fmt(summary.paid)}</b></div><div><small>剩餘金額（本月帳單）</small><b>${fmt(summary.remaining)}</b></div><div><small>截至本月尚待繳</small><b>${fmt(total)}</b></div><div><small>可用金額（額度）</small><b>${available===null?'未設定':fmt(available)}</b></div></div><div class="form-row"><div class="form-field"><label>本次繳款 NT$</label><input id="cb-amount" type="number" min="1" max="${total}" step="1" inputmode="numeric" value="${total}" required></div><div class="form-field"><label>實際繳款日</label><input id="cb-date" type="date" value="${today()}" required></div></div><div id="cc-after-payment" class="cc-payment-preview" aria-live="polite"></div><div class="form-field"><label>扣款現金／銀行帳戶</label><select id="cb-account">${accountOpts(c.paymentAccountId)}</select></div><p class="inline-note">本次繳款會先抵扣較早月份的未繳帳單。可用金額是信用卡額度，不是銀行現金。若指定銀行帳戶，只在確認已繳時扣款一次。</p>${actions('確認已繳')}</form>`,'cb-amount');
 const updatePreview=()=>{const amount=currencyInput('cb-amount'),ok=centsInt(amount)&&amount<=total;$('cc-after-payment').innerHTML=ok?`<span>繳款後尚待繳 <strong>${fmt(total-amount)}</strong></span><span>繳款後可用金額 <strong>${available===null?'未設定':fmt(Math.max(0,c.limit-(totalCardOutstanding(id)-amount)))}</strong></span>`:'請輸入 1 ～ '+fmt(total)+' 的繳款金額';$('cc-after-payment').classList.toggle('invalid',!ok)};
 $('cb-amount').addEventListener('input',updatePreview);updatePreview();
 $('card-bill-form').addEventListener('submit',e=>{e.preventDefault();let remaining=currencyInput('cb-amount');const date=$('cb-date').value,accountId=$('cb-account').value||null;if(!centsInt(remaining)||remaining>total||!isDate(date)){toast('請確認繳款金額');return}const groupId=uid();if(persist(s=>{for(const row of parts){if(remaining<=0)break;const value=Math.min(remaining,row.remaining);s.cardPayments.push({id:uid(),groupId,cardId:id,accountId,date,amount:value,sourceType:row.type,sourceId:row.id,sourceMonth:row.type==='installment'?row.month:null});remaining-=value}})){closeModal();toast('繳款已記錄，已扣銀行餘額（如有指定）')}});
}
function undoCardPaymentGroup(id){const group=state.cardPayments.filter(x=>x.groupId===id);if(!group.length)return;const amount=group.reduce((s,x)=>s+x.amount,0);if(!confirm('確定只撤銷這筆 '+fmt(amount)+' 的信用卡繳款？會還原原扣款帳戶餘額。'))return;const cardId=group[0].cardId;if(persist(s=>s.cardPayments=s.cardPayments.filter(x=>x.groupId!==id))){closeModal();toast('這筆卡費繳款已撤銷');cardDetail(cardId)}}

function bankReconcileModal(){
 const accounts=cashAccounts().filter(a=>a.kind==='bank');
 if(!accounts.length){toast('請先新增銀行帳戶，再校正餘額');return}
 const pending=state.pendingBalanceConfirmation;
 const suggested=pending&&isMoney(pending.amount)?pending.amount:null;
 const choices=option('','請選擇實際存放金額的銀行帳戶','')+accounts.map(a=>option(a.id,a.name,'')).join('');
 openModal('校正目前銀行餘額',`<form id="bank-reconcile-form"><div class="help-box"><strong>以現在看到的銀行餘額為準</strong><br>若先前已經繳了信用卡，現在才開始記帳，這裡只校正目前餘額，不會再記一筆支出，也不會重複扣掉那次卡費。</div><div class="form-field"><label>這筆錢實際在哪個銀行帳戶？</label><select id="br-account" required>${choices}</select></div><div class="form-field"><label>銀行 App 現在顯示的餘額 NT$</label><input id="br-amount" type="number" inputmode="numeric" min="0" max="10000000000" step="1" required value="${suggested===null?'':suggested}"></div><p id="br-preview" class="inline-note">請先選擇銀行帳戶。</p>${actions('確認校正')}</form>`);
 const preview=()=>{const a=accountById($('br-account').value);$('br-preview').textContent=a?`目前小金庫記錄 ${fmt(accountBalance(a.id))}；校正後將顯示輸入的實際餘額。其他銀行帳戶不變。`:'請先選擇實際扣款的銀行帳戶。'};
 $('br-account').addEventListener('change',preview);$('br-amount').addEventListener('input',preview);preview();
 $('bank-reconcile-form').addEventListener('submit',e=>{e.preventDefault();const accountId=$('br-account').value,amount=currencyInput('br-amount'),a=accountById(accountId);if(!a||a.kind!=='bank'||!isMoney(amount)){toast('請確認銀行與金額');return}
  const correctedOpening=a.opening+(amount-accountBalance(accountId));if(!isMoney(correctedOpening)){toast('這個帳戶已有歷史紀錄，無法直接校正；請先核對舊交易');return}
  if(persist(s=>{s.accounts.find(x=>x.id===accountId).opening=correctedOpening;delete s.pendingBalanceConfirmation})){closeModal();toast('已校正銀行餘額，不會重複扣舊卡費')}
 });
}

function settingsModal(){openModal('設定與備份',`<div class="help-box ${saveError?'':'success-box'}"><strong>${saveError?'本機儲存可能異常':'● 自動儲存已開啟'}</strong><br>所有帳戶、信用卡刷卡、卡費繳款、分期與 52 週存錢紀錄，每次操作都自動儲存在這部裝置。</div><button class="block-button" type="button" id="backup-export">↓ 下載 JSON 資料備份</button><button class="block-button" type="button" id="finxi-import">↑ 匯入 FINXI 分期（合併，不覆蓋）</button><button class="block-button" type="button" id="backup-import">↑ 還原小金庫 JSON（會覆蓋）</button><p class="inline-note">資料不會連接銀行或自動上傳。清除 Safari 網站資料、換手機或更換網址，可能遺失本機紀錄。請定期下載 JSON 備份；備份未加密，請妥善保管。</p><div class="help-box">${wasMigrated?'已沿用上一版的帳戶、分期與存錢資料。':'如果原版已有資料，應沿用同一個網站網址更新；本機資料不會自動跨網址同步。'}<br>已停用「帳戶轉帳」操作，歷史紀錄只用於保留過去帳戶餘額的計算。</div>`);$('backup-export').addEventListener('click',exportBackup);$('finxi-import').addEventListener('click',()=>$('finxi-file').click());$('backup-import').addEventListener('click',()=>$('import-file').click())}

function exportBackup(){const out=JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),url=URL.createObjectURL(new Blob([out],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='小金庫_資料備份_'+today()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('備份已準備下載，請妥善保存')}

/* FINXI 合併匯入：只轉移可確認的未來分期，不修改任何既有帳戶、交易、0050 或存錢格子。 */
function scanFinxiBackup(source){
 if(!source||source.schemaVersion!==1||!Array.isArray(source.accounts)||!source.accounts.length||!Array.isArray(source.transactions))throw Error('這不是可辨識的 FINXI JSON 備份');
 const result={ready:[],review:[],existing:0};
 const num=v=>{if(!/^\d+$/.test(String(v??'')))return null;const n=Number(v);return Number.isSafeInteger(n)&&n<=MAX?n:null};
 for(const a of source.accounts){
  if(a?.group!=='liability'||a.category!=='分期付款')continue;
  const sourceId=typeof a.id==='string'&&a.id?a.id:null;
  const name=typeof a.name==='string'?a.name.trim().slice(0,80):'';
  const rem=num(a.installmentRemainingAmount),monthly=num(a.installmentPaymentAmount),remainingCount=num(a.installmentRemainingCount),originalTotal=num(a.installmentTotalAmount);
  const next=a.nextDebitDate;
  if(!sourceId||!name)continue;
  const id='finxi:'+sourceId;
  if(state.installments.some(z=>z.id===id)){result.existing++;continue}
  if(state.installments.some(z=>z.name===name&&z.total===rem&&z.months===remainingCount&&z.startMonth===next?.slice(0,7))){result.existing++;continue}
  const meta={id:sourceId,name,remainingAmount:rem,remainingCount,paymentAmount:monthly,nextDebitDate:typeof next==='string'?next:'',originalTotal,sourceCard:typeof a.repaymentAccount==='string'?a.repaymentAccount.slice(0,50):''};
  const valid=centsInt(rem)&&centsInt(monthly)&&Number.isSafeInteger(remainingCount)&&remainingCount>=1&&remainingCount<=120&&isDate(next)&&originalTotal!=null&&originalTotal>=rem&&monthly*remainingCount===rem;
  if(!valid){result.review.push(meta);continue}
  result.ready.push({id,name,total:rem,months:remainingCount,startMonth:next.slice(0,7),cardId:cardAccounts().find(c=>c.name===meta.sourceCard)?.id||null,card:meta.sourceCard,paidMonths:[],paymentDetails:{},finxiSourceId:sourceId,finxiOriginalTotal:originalTotal,finxiDueDay:Number(next.slice(-2)),finxiImportedAt:today()});
 }
 return result;
}
function finxiImportPreview(data){
 let result;
 try{result=scanFinxiBackup(data)}catch(err){alert('無法匯入：'+err.message);return}
 if(!result.ready.length){alert(result.existing?'FINXI 可確認的分期已經匯入過了，不會重複新增。待核對的資料請在「分期」頁面檢查。':'這份 FINXI 備份沒有可直接匯入的分期，請先核對有差異的紀錄。');return}
 const sum=result.ready.reduce((a,z)=>a+z.total,0);
 const note=result.review.map(r=>`<div class="label-row"><span>${safe(r.name)} · 剩 ${safe(r.remainingCount??'未知')} 期</span><strong>${fmt(r.remainingAmount)}</strong></div><small class="item-sub">每期 ${fmt(r.paymentAmount)}，需先核對；不列入每月應繳</small>`).join('');
 openModal('從 FINXI 合併分期',`<div class="help-box success-box"><strong>可新增 ${result.ready.length} 筆 · 剩餘應繳 ${fmt(sum)}</strong><br>已存在而略過 ${result.existing} 筆；待核對 ${result.review.length} 筆。</div><p class="inline-note">只新增尚未繳清的後續期數，不重建舊繳款、不修改現金帳戶、不重新扣款，也不會刪除你的記帳或 52 週存錢紀錄。已繳期的確切日期因來源未提供，這裡只保留原始總價與剩餘期數。</p>${result.review.length?`<div class="help-box"><strong>需先核對</strong>${note}</div>`:''}<div class="form-actions"><button type="button" class="cancel" data-action="close">取消</button><button type="button" class="submit" id="finxi-confirm">確認合併 ${result.ready.length} 筆</button></div>`);
 $('finxi-confirm').addEventListener('click',()=>{
  if(!result.ready.length){closeModal();return}
  if(persist(s=>{
   const ids=new Set(s.installments.map(x=>x.id));
   for(const p of result.ready)if(!ids.has(p.id)){s.installments.push(p);ids.add(p.id)}
   const old=Array.isArray(s.finxiNeedsReview)?s.finxiNeedsReview:[];
   const known=new Set(old.map(r=>r.id));
   for(const r of result.review)if(!known.has(r.id)){old.push(r);known.add(r.id)}
   s.finxiNeedsReview=old;
  })){
   closeModal();switchPage('installments');toast('FINXI 分期已合併，原有資料全部保留');
  }
 });
}
$('finxi-file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file)return;
 if(file.size>10*1024*1024){alert('FINXI 備份大於 10 MB，為安全起見未讀取');return}
 try{finxiImportPreview(JSON.parse(await file.text()))}catch(e){alert('讀取 FINXI 檔案失敗，原有資料未更動。')}
});

$('import-file').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>10*1024*1024){alert('備份檔過大，為安全起見未匯入');return}try{const parsed=JSON.parse(await file.text()),data=validV3(parsed)?parsed:(validV2(parsed)?migrateV3(parsed):(validV1(parsed)?migrateV3(fromLegacy(parsed)):null));if(!data||!validV3(data)){alert('備份資料格式不正確，現有資料沒有被覆蓋');return}if(!confirm('確定用這份備份取代目前小金庫的全部資料？建議先匯出目前備份。'))return;localStorage.setItem(KEY,JSON.stringify(data));state=data;blocked=false;saveError=false;selectedWeek=currentWeek();closeModal();render();toast('已成功還原，資料已自動儲存')}catch(err){alert('無法讀取或儲存這個備份，原有資料保持不變。')}});
$('settings-btn').addEventListener('click',settingsModal);$('modal-close').addEventListener('click',closeModal);$('backdrop').addEventListener('click',e=>{if(e.target===$('backdrop'))closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('backdrop').hidden)closeModal()});
$('reserve-add').addEventListener('click',()=>reserveModal());$('recurring-add').addEventListener('click',()=>recurringModal());
$('home-month').addEventListener('change',e=>{if(validMonth(e.target.value)){homeMonth=e.target.value;renderHome()}});
$('ledger-month').addEventListener('change',e=>{if(validMonth(e.target.value)){ledgerMonth=e.target.value;renderLedger()}});
$('install-month').addEventListener('change',e=>{if(validMonth(e.target.value)){installMonth=e.target.value;renderInstallments()}});
$('tx-filters').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;ledgerFilter=b.dataset.filter;document.querySelectorAll('#tx-filters button').forEach(x=>x.classList.toggle('chosen',x===b));renderLedger()});
$('bank-reconcile').addEventListener('click',bankReconcileModal);$('account-add').addEventListener('click',()=>accountModal());$('card-add').addEventListener('click',()=>{accountModal();$('a-kind').value='card';$('a-kind').dispatchEvent(new Event('change'))});$('tx-add').addEventListener('click',()=>transactionModal());$('home-add').addEventListener('click',()=>transactionModal());$('install-add').addEventListener('click',()=>installmentModal());$('invest-settings').addEventListener('click',investmentSettings);$('invest-record').addEventListener('click',()=>investmentRecordModal());$('savings-settings').addEventListener('click',savingsSettings);
$('week-prev').addEventListener('click',()=>{selectedWeek=Math.max(0,selectedWeek-1);renderSavings()});$('week-next').addEventListener('click',()=>{selectedWeek=Math.min(51,selectedWeek+1);renderSavings()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-tab],[data-action]');if(!b)return;if(b.dataset.tab){switchPage(b.dataset.tab);return}const action=b.dataset.action,id=b.dataset.id;switch(action){case'recurring-edit':recurringModal(id);break;case'recurring-skip':{const r=recurringReserves().find(z=>z.id===id);if(r&&confirm('確定「'+r.name+'」在 '+homeMonth+' 不預留嗎？其他月份不受影響。')&&persist(x=>{const item=x.recurringReserves.find(z=>z.id===id);if(!item.skippedMonths.includes(homeMonth))item.skippedMonths.push(homeMonth)}))toast('本月已略過固定預留');break;}case'reserve-edit':reserveModal(id);break;case'reserve-spend':reserveSpendModal(id);break;case'reserve-delete':{const r=reserves().find(z=>z.id===id&&z.status==='reserved');if(r&&confirm('取消「'+r.name+'」這筆預留嗎？這不會影響實際帳戶餘額。')&&persist(x=>{x.reserves=x.reserves.filter(z=>z.id!==id)}))toast('已取消預留');break;}case'reserve-copy':{const r=reserves().find(z=>z.id===id);if(r&&persist(x=>{x.reserves=x.reserves||[];x.reserves.push({...r,id:uid(),month:monthFrom(monthIndex(r.month)+1),status:'reserved',transactionId:null})}))toast('已複製到下個月');break;}case'close':closeModal();break;case'account-edit':accountModal(id);break;case'bank-reconcile':bankReconcileModal();break;case'tx-account':transactionModal(undefined,id);break;case'tx-edit':transactionModal(id);break;case'card-detail':cardDetail(id);break;case'card-charge':chargeModal(undefined,id);break;case'card-charge-edit':chargeModal(id);break;case'card-payment-undo':undoCardPaymentGroup(id);break;case'install-edit':installmentModal(id);break;case'finxi-review-edit':finxiReviewModal(id);break;case'install-pay':paymentModal(id);break;case'invest-edit':investmentRecordModal(id);break;case'deposit':depositModal(Number(b.dataset.index));break;case'week':selectedWeek=Number(b.dataset.index);renderSavings();break;}});
window.addEventListener('storage',e=>{if(e.key!==KEY||!e.newValue)return;try{const d=JSON.parse(e.newValue);if(validV3(d)){state=d;saveError=false;render();toast('資料已從另一個分頁同步')}}catch{}});
render();
if(blocked)setTimeout(()=>alert('偵測到無法讀取的舊資料。為避免覆蓋，你的本機寫入已暫停；請先保留舊版備份。'),300);
if(wasMigrated)setTimeout(()=>toast('舊版資料已沿用，信用卡功能可開始使用'),600);
if('serviceWorker' in navigator && location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
