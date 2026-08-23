// Google Sheets dialogı mümkün olan en geniş boyuta çıkar.
(function(){
  try{
    if(window.google && google.script && google.script.host){
      google.script.host.setWidth(1800);
      google.script.host.setHeight(1000);
    }
  }catch(e){}
})();

let DATA=null, PAGE='dashboard', DETAIL=null, FILTER={year:null,month:null};
let PAYMENTS_FILTER={year:'all',month:'all'};
const months=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const money=n=>Number(n||0).toLocaleString('tr-TR',{minimumFractionDigits:0,maximumFractionDigits:0})+' ₺';
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
/* Branş / grup gibi metin değerlerine, değere göre sabit ve tutarlı bir renk atar.
   Sheets'teki AYARLAR sayfasında hangi branş/grup adı olursa olsun otomatik çalışır. */
const TAG_PALETTE=['#2f6bf0','#12a76d','#e0424c','#dd9021','#7c5cd8','#0ea5c4','#d6489a','#5a8f3c','#b23b6b','#3c7ea6','#c9762f','#5f6fd1'];
function tagColor(str){
  str=String(str||'');
  let h=0;
  for(let i=0;i<str.length;i++){h=(h*31+str.charCodeAt(i))>>>0}
  return TAG_PALETTE[h%TAG_PALETTE.length];
}
function colorTag(str){
  if(!str)return '<span class="muted">—</span>';
  const c=tagColor(str);
  return `<span class="badge" style="background:${c}2a;color:${c};border:1px solid ${c}70">${esc(str)}</span>`;
}
const fmtDate=s=>s||'—';
function toast(t){const x=document.getElementById('toast');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2600)}
function err(e){toast('Hata: '+(e&&e.message?e.message:e));document.getElementById('content').innerHTML='<div class="empty">Veri alınamadı.<br><small>'+esc(e&&e.message?e.message:e)+'</small></div>'}
function call(name,args,ok){let r=google.script.run.withSuccessHandler(ok).withFailureHandler(err);r[name](...(args||[]))}
// Form kaydetme çağrıları için: hata olursa sadece toast gösterilir, form/sayfa açık kalır (err() gibi tüm içeriği silmez).
function callForm(name,args,ok){let r=google.script.run.withSuccessHandler(ok).withFailureHandler(e=>toast('Hata: '+(e&&e.message?e.message:e)));r[name](...(args||[]))}
function isStandaloneApp(){
 return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || window.navigator.standalone === true;
}
async function enterAppMode(){
 try{
  if(isStandaloneApp()){toast('Uygulama modu zaten aktif.');return;}
  if(document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen({navigationUI:'hide'});toast('Tam ekran uygulama modu açıldı.');}
  else toast('Tarayıcı tam ekranı desteklemiyor. Ana ekrana ekleyerek uygulama gibi kullanabilirsiniz.');
 }catch(e){toast('Tam ekran açılamadı. Tarayıcı menüsünden "Ana ekrana ekle" seçeneğini kullanın.');}
}
function refresh(){document.getElementById('content').innerHTML='<div class="loading"><div><div class="spinner"></div><p style="text-align:center;margin-top:12px">Sheets yeniden okunuyor…</p></div></div>';call('panelV1MobilOzetGetir',[],d=>{DATA=d;syncSide();render()})}
/* Kayıt sonrası "sessiz" yenileme: mevcut ekranı boşaltıp döndürme yapmadan
   arka planda veriyi tazeler — kullanıcı işlemine devam ederken performans hissi artar. */
function refreshQuiet(cb){call('panelV1MobilOzetGetir',[],d=>{DATA=d;syncSide();render();if(cb)cb();})}
function syncSide(){if(!DATA)return;document.getElementById('sideStudents').textContent=DATA.activeStudents;document.getElementById('sideDebt').textContent=money(DATA.totalDebt);}
const MOBILE_BREAKPOINT=900;
function isMobileView(){return window.innerWidth<=MOBILE_BREAKPOINT}
const MORE_PAGES=['annual','finance','courses'];
function openMore(){document.getElementById('moreSheet').classList.add('open')}
function closeMore(){document.getElementById('moreSheet').classList.remove('open')}
function goMore(p){closeMore();go(p)}
function go(p){PAGE=p;if(p==='payments'&&DATA){PAYMENTS_FILTER={year:String(DATA.year),month:String(DATA.month)};}document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===p));const titles={dashboard:['Genel Bakış','Kulübün canlı finans, öğrenci ve katılım özeti'],students:['Öğrenciler','Tüm öğrenci bilgileri ve kişisel durumlar'],payments:['Ödemeler','Gerçek ödeme kayıtları ve tahsilat analizi'],annual:['Yıllık Ödemeler','Yıl bazında öğrenci ödeme durumu'],finance:['Gelir / Gider','Gerçek gelir ve giderlerin karşılaştırması'],attendance:['Yoklama','YOKLAMA KAYITLARI üzerinden aylık ve yıllık katılım'],courses:['Dersler','Haftalık ders programı ve antrenör ataması'],reports:['Gelişim Raporları','Öğrencilerin branşa özel gelişim ve performans raporları']};document.getElementById('pageTitle').textContent=titles[p][0];document.getElementById('pageSub').textContent=titles[p][1];render()}
let _lastViewWasMobile=null;
window.addEventListener('resize',()=>{const m=isMobileView();if(m!==_lastViewWasMobile){_lastViewWasMobile=m;if(PAGE==='dashboard')render()}});
function onPaymentsFilterChange(kind,val){PAYMENTS_FILTER[kind]=val;render()}
function render(){if(!DATA){refresh();return}({dashboard:renderDashboard,students:renderStudents,payments:renderPayments,annual:renderAnnual,finance:renderFinance,attendance:renderAttendance,courses:renderCourses,reports:renderReports}[PAGE])()}
const KPI_VALUE_COLOR={green:'var(--green)',redbg:'var(--red)',amberbg:'var(--amber)',blue:'var(--blue)',cyanbg:'var(--blue)',purplebg:'var(--purple)'};
function card(icon,cls,label,val,sub=''){return `<div class="card"><div class="kpiIcon ${cls}">${icon}</div><small>${label}</small><strong style="color:${KPI_VALUE_COLOR[cls]||'var(--text)'}">${val}</strong><small>${sub}</small></div>`}


function renderBranchDonut(){
  const students=(DATA.students||[]).filter(s=>String(s.status||'Aktif')!=='Pasif');
  const counts={};
  students.forEach(s=>{
    const b=String(s.branch||'Diğer').trim()||'Diğer';
    counts[b]=(counts[b]||0)+1;
  });
  const items=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const total=items.reduce((a,x)=>a+x[1],0);
  const palette=['#2867f0','#17a673','#e49b22','#7657d8','#db4aa7','#0ba6c7','#e5484d','#5b708e'];
  const donut=document.getElementById('branchDonut');
  const legend=document.getElementById('branchLegend');
  const totalEl=document.getElementById('branchTotal');
  if(!donut||!legend||!totalEl)return;
  totalEl.textContent=total;
  let cursor=0;
  const stops=items.map((x,i)=>{
    const from=cursor;
    cursor += total ? (x[1]/total)*360 : 0;
    return `${palette[i%palette.length]} ${from}deg ${cursor}deg`;
  });
  donut.style.background=items.length?`conic-gradient(${stops.join(',')})`:'#e9eef5';
  legend.innerHTML=items.slice(0,8).map((x,i)=>`
    <div class="branchLegendRow">
      <span><i style="background:${palette[i%palette.length]}"></i>${esc(x[0])}</span>
      <b>${x[1]}</b>
    </div>`).join('') || '<div class="empty">Branş verisi bulunamadı.</div>';
}


function renderMobilePaymentAlert(d){
  const t=d.mobilePaymentTracking||{};
  const approaching=t.approaching||[];
  const overdue=t.overdue||[];
  const rows=[...overdue.slice(0,3).map(x=>Object.assign({kind:'overdue'},x)),
              ...approaching.slice(0,3).map(x=>Object.assign({kind:'approaching'},x))];

  if(!rows.length){
    return `<div class="mobilePaymentAlert">
      <div class="mobilePaymentAlertHead">
        <b>🔔 Ödeme Takibi</b><span class="badge bgreen">Sorun yok</span>
      </div>
      <div class="mobilePaymentAlertBody">
        <div class="empty" style="padding:18px 8px;font-size:10px">Yaklaşan veya geciken ödeme bulunmuyor.</div>
      </div>
    </div>`;
  }

  return `<div class="mobilePaymentAlert">
    <div class="mobilePaymentAlertHead">
      <b>🔔 Ödeme Takibi</b>
      <span class="muted" style="font-size:9px">${t.overdueCount||0} geciken · ${t.approachingCount||0} yaklaşan</span>
    </div>
    <div class="mobilePaymentAlertBody">
      ${rows.map(x=>{
        const overdue=x.kind==='overdue';
        const label=overdue
          ? `🔴 ${Math.abs(Number(x.daysUntil||0))} gün gecikmiş`
          : (Number(x.daysUntil)===0 ? '🟠 Bugün ödeme günü' : `🟠 ${x.daysUntil} gün kaldı`);
        return `<div class="mobilePaymentAlertRow">
          <div style="min-width:0">
            <div class="mobilePaymentAlertName">${esc(x.name)}</div>
            <div class="mobilePaymentAlertSub">${esc(label)} · ${esc(x.branch||'')}</div>
          </div>
          <div class="mobilePaymentAlertAmount">${money(x.remaining)}</div>
        </div>`;
      }).join('')}
    </div>
    <div class="mobilePaymentAlertActions">
      <button class="btn small" onclick="go('payments')">💳 Ödemelere Git</button>
      <button class="btn small primary" onclick="go('students')">👥 Öğrenciler</button>
    </div>
  </div>`;
}

function mCard(icon,cls,label,val,sub){
  return `<div class="mCard"><div class="mCardIcon ${cls}">${icon}</div><div class="mCardBody"><small>${esc(label)}</small><strong style="color:${KPI_VALUE_COLOR[cls]||'var(--text)'}">${val}</strong>${sub?`<span class="mCardSub">${esc(sub)}</span>`:''}</div></div>`;
}
function renderDashboardMobile(d){
  const active=Number(d.activeStudents||0);
  const net=Number(d.netMonth||0);
  const todayAtt=(d.rawAttendance||[]).filter(r=>r.dateKey===d.todayISO);
  const todayPresent=todayAtt.filter(r=>r.status==='Geldi').length;
  const attValue=todayAtt.length?`${todayPresent}/${todayAtt.length}`:'—';
  const attSub=todayAtt.length?'Geldi / İşlenen':'Bugün henüz işlenmedi';

  document.getElementById('content').innerHTML=`
    <div class="mHero">
      <small>${esc(d.today||'')}</small>
      <h2>IŞIK Spor Kulübü</h2>
      <p>Kulübün bugünkü durumu tek bakışta</p>
    </div>

    <div class="kpiNetGrid" style="margin-top:0">
      <div class="kpiNetCard">
        <small>${esc((months[d.month]||'').toUpperCase())} ${esc(String(d.year||''))} · NET KAR / ZARAR</small>
        <strong>${money(net)}</strong>
        <div class="kpiNetSub">${net>=0?'📈':'✉️'} Bu ay ${net>=0?'kâr':'zarar'} &nbsp;·&nbsp; Gelir ${money(d.monthPaid)} − Gider ${money(d.monthExpense)}</div>
      </div>
      <div class="accentCard" style="--accent:var(--green)">
        <div class="accentLabel">💰 Toplam Gelir</div>
        <div class="accentValue" style="color:var(--green)">${money(d.monthPaid)}</div>
      </div>
      <div class="accentCard" style="--accent:var(--blue)">
        <div class="accentLabel">👤 Aktif Öğrenci</div>
        <div class="accentValue" style="color:var(--blue)">${active}</div>
      </div>
      <div class="accentCard" style="--accent:var(--red)">
        <div class="accentLabel">💸 Toplam Gider</div>
        <div class="accentValue" style="color:var(--red)">${money(d.monthExpense)}</div>
      </div>
      <div class="accentCard" style="--accent:var(--amber)">
        <div class="accentLabel">⏳ Bekleyen Ödeme</div>
        <div class="accentValue" style="color:var(--amber)">${money(d.totalDebt)}</div>
      </div>
    </div>

    <div class="mKpiGrid">
      ${mCard('📋','green','Bugünkü Yoklama',attValue,attSub)}
      ${mCard('🎯','cyanbg','Aktif/Pasif',active+' / '+Number(d.inactiveStudents||0),'Öğrenci durumu')}
    </div>

    <div class="mQuick">
      <button class="mQuickPrimary" onclick="openStudentForm()"><i>＋</i><span>Öğrenci Ekle</span></button>
      <button onclick="quickPaymentPicker()"><i>💳</i><span>Ödeme Al</span></button>
      <button onclick="quickAttendancePicker()"><i>📋</i><span>Yoklama Gir</span></button>
      <button onclick="quickStudentSearch()"><i>🔎</i><span>Öğrenci Ara</span></button>
    </div>

    ${renderMobilePaymentAlert(d)}
  `;
}
function renderDashboard(){
  const d=DATA||{};
  if(isMobileView()){ _lastViewWasMobile=true; renderDashboardMobile(d); return; }
  _lastViewWasMobile=false;
  const payments=d.rawPayments||[], expenses=d.rawExpenses||[];
  const active=Number(d.activeStudents||0), passive=Number(d.inactiveStudents||0);
  const net=Number(d.netMonth||0);
  const labels=[], vals={};
  for(let i=5;i>=0;i--){
    let y=Number(d.year),m=Number(d.month)-i;
    while(m<0){m+=12;y--}
    labels.push({y,m});
    vals[y+'-'+String(m+1).padStart(2,'0')]={in:0,out:0};
  }
  payments.forEach(p=>{
    const k=String(p.monthKey||'').slice(0,7);
    if(vals[k])vals[k].in+=Number(p.paid||0);
  });
  expenses.forEach(x=>{
    const k=String(x.dateKey||'').slice(0,7);
    if(vals[k])vals[k].out+=Number(x.amount||0);
  });
  const max=Math.max(1,...Object.values(vals).flatMap(x=>[x.in,x.out]));
  const bars=labels.map(x=>{
    const k=x.y+'-'+String(x.m+1).padStart(2,'0'),v=vals[k],lab=months[x.m];
    return `<div class="barWrap" title="${lab} ${x.y} · Gelir ${money(v.in)} · Gider ${money(v.out)}">
      <div class="bar in" style="height:${Math.max(4,v.in/max*92)}%"></div>
      <div class="bar out" style="height:${Math.max(4,v.out/max*92)}%"></div>
      <div style="position:absolute;transform:translateY(18px)"><div class="barLabel">${lab.slice(0,3)}</div></div>
    </div>`;
  }).join('');

  const recent=(d.recentPayments||[]).slice(0,6).map(x=>`
    <tr>
      <td><b>${esc(x.name)}</b><br><small class="muted">${esc(x.month||'')}</small></td>
      <td>${esc(x.method||'')}</td>
      <td style="color:var(--green);font-weight:700">+${money(x.amount)}</td>
    </tr>`).join('');

  document.getElementById('content').innerHTML=`
    <div class="hero">
      <div>
        <small style="opacity:.75;letter-spacing:1px">CANLI SHEETS · ${esc(d.today||'')}</small>
        <h2>Genel Bakış</h2>
        <p>Kulübün finans, öğrenci ve operasyon durumunu tek ekranda takip et.</p>
      </div>
      <div class="heroRight">
        <div class=" pill"><span class="pillIcon">🟢</span> Aktif <b>${active}</b></div>
        <div class="pill"><span class="pillIcon">🔴</span> Pasif <b>${passive}</b></div>
      </div>
    </div>

    <div class="kpiNetGrid">
      <div class="kpiNetCard">
        <small>${esc((months[d.month]||'').toUpperCase())} ${esc(String(d.year||''))} · NET KAR / ZARAR</small>
        <strong>${money(net)}</strong>
        <div class="kpiNetSub">${net>=0?'📈':'✉️'} Bu ay ${net>=0?'kâr':'zarar'} &nbsp;·&nbsp; Gelir ${money(d.monthPaid)} − Gider ${money(d.monthExpense)}</div>
      </div>
      <div class="accentCard" style="--accent:var(--green)">
        <div class="accentLabel">💰 Toplam Gelir</div>
        <div class="accentValue" style="color:var(--green)">${money(d.monthPaid)}</div>
      </div>
      <div class="accentCard" style="--accent:var(--blue)">
        <div class="accentLabel">👤 Aktif Öğrenci</div>
        <div class="accentValue" style="color:var(--blue)">${active}</div>
      </div>
      <div class="accentCard" style="--accent:var(--red)">
        <div class="accentLabel">💸 Toplam Gider</div>
        <div class="accentValue" style="color:var(--red)">${money(d.monthExpense)}</div>
      </div>
      <div class="accentCard" style="--accent:var(--amber)">
        <div class="accentLabel">⏳ Bekleyen Ödeme</div>
        <div class="accentValue" style="color:var(--amber)">${money(d.totalDebt)}</div>
      </div>
    </div>

    <div class="card dashboardSection" style="margin-top:12px">
      <div class="cardHead"><h3>⚡ Hızlı İşlemler</h3><span class="muted">En sık kullanılan işlemler</span></div>
      <div class="quick">
        <button class="quickAction addStudentQuick" onclick="openStudentForm()">＋ Öğrenci Ekle</button>
        <button class="quickAction" onclick="quickPaymentPicker()">💳 Ödeme Al</button>
        <button class="quickAction" onclick="quickAttendancePicker()">📋 Yoklama Gir</button>
        <button class="quickAction" onclick="quickStudentSearch()">🔎 Öğrenci Ara</button>
      </div>
    </div>

    ${renderMobilePaymentAlert(d)}

    <div class="grid cols" style="margin-bottom:12px">
      <div class="card">
        <div class="cardHead"><h3>📊 Son 6 Ay · Finans</h3><span class="muted">Gerçek ödeme + gider kayıtları</span></div>
        <div class="chart">${bars}</div>
      </div>

      <div class="card branchCard">
        <div class="cardHead"><h3>🥧 Branş Dağılımı</h3><span class="muted">Aktif öğrenciler</span></div>
        <div class="branchChartWrap">
          <div class="donut" id="branchDonut"><div><b id="branchTotal">0</b><span>Öğrenci</span></div></div>
          <div class="branchLegend" id="branchLegend"></div>
        </div>
      </div>
    </div>

    <div class="grid cols2">
      <div class="card tableCard tableCompact">
        <div class="tableTop">
          <b>📌 Bu Ay Takip Özeti</b>
          <button class="btn small" onclick="go('finance')">Finansa Git</button>
        </div>
        <div class="miniInfoList">
          <div class="miniInfoRow"><div><b>Bu ay tahsilat</b><small class="muted">Gerçekleşen ödemeler</small></div><span style="color:var(--green)">${money(d.monthPaid)}</span></div>
          <div class="miniInfoRow"><div><b>Bu ay gider</b><small class="muted">Kayıtlı giderler</small></div><span style="color:var(--red)">${money(d.monthExpense)}</span></div>
          <div class="miniInfoRow"><div><b>Bu ay net</b><small class="muted">Tahsilat − gider</small></div><span style="color:${net>=0?'var(--green)':'var(--red)'}">${money(net)}</span></div>
          <div class="miniInfoRow"><div><b>Toplam bekleyen</b><small class="muted">Öğrenci borçları</small></div><span style="color:var(--amber)">${money(d.totalDebt)}</span></div>
        </div>
      </div>

      <div class="card tableCard tableCompact">
        <div class="tableTop">
          <b>💚 Son Ödemeler</b>
          <button class="btn small" onclick="go('payments')">Tümünü Gör</button>
        </div>
        <div class="miniInfoList">
          ${(d.recentPayments||[]).slice(0,6).map(x=>`
            <div class="miniInfoRow"><div><b>${esc(x.name)}</b><small class="muted">${esc(x.method||'')}${x.month?' · '+esc(x.month):''}</small></div><span style="color:var(--green)">+${money(x.amount)}</span></div>
          `).join('') || '<div class="empty">Ödeme yok.</div>'}
        </div>
      </div>
    </div>`;

  renderBranchDonut();
}

function filterBar(type){
  const oldSearch=document.getElementById('search')?.value||'';
  const oldYear=type==='payments'?PAYMENTS_FILTER.year:(document.getElementById('yearFilter')?.value||'all');
  const oldMonth=type==='payments'?PAYMENTS_FILTER.month:(document.getElementById('monthFilter')?.value||'all');
  const onYearChange=type==='payments'?`onPaymentsFilterChange('year',this.value)`:'render()';
  const onMonthChange=type==='payments'?`onPaymentsFilterChange('month',this.value)`:'render()';

  return `<div class="tableTop">
    <input id="search" value="${esc(oldSearch)}"
      placeholder="🔎 Öğrenci / ID / açıklama ara…" oninput="render()">

    <select id="yearFilter" onchange="${onYearChange}">
      <option value="all">Tüm yıllar</option>
      ${yearsFor(type).map(y=>`
        <option value="${y}" ${String(y)===String(oldYear)?'selected':''}>${y}</option>
      `).join('')}
    </select>

    <select id="monthFilter" onchange="${onMonthChange}">
      <option value="all">Tüm aylar</option>
      ${months.map((m,i)=>`
        <option value="${i}" ${String(i)===String(oldMonth)?'selected':''}>${m}</option>
      `).join('')}
    </select>

    <button class="btn small" onclick="openSheet('${sheetFor(type)}')">
      Sheet'i Aç
    </button>
  </div>`;
}
function yearsFor(type){
  const set=new Set();
  let arr=[];

  if(type==='payments') arr=DATA.rawPayments||[];
  else if(type==='attendance') arr=DATA.rawAttendance||[];
  else if(type==='expenses') arr=DATA.rawExpenses||[];
  else if(type==='finance'){
    arr=[...(DATA.rawPayments||[]),...(DATA.rawExpenses||[])];
  }

  arr.forEach(r=>{
    const k=type==='finance'
      ? (r.paymentDate?financeDateKey_(r.paymentDate):(r.dateKey||financeDateKey_(r.date)))
      : (r.monthKey||r.dateKey||'');

    if(k && /^\d{4}-\d{2}/.test(k)){
      set.add(Number(k.slice(0,4)));
    }
  });

  if(!set.size)set.add(DATA.year);
  return [...set].sort((a,b)=>b-a);
}
function sheetFor(t){return t==='payments'?'ÖDEME KAYITLARI':t==='attendance'?'YOKLAMA KAYITLARI':t==='expenses'?'GİDERLER':t==='annual'?'YILLIK ÖDEMELER':'GELİR-GİDER'}
function passFilter(r,type){
  // NOT: renderX() fonksiyonları bu filtreyi, filtre HTML'ini (filterBar) henüz
  // DOM'a yazmadan ÖNCE çalıştırır. Ödemeler sekmesinde ay/yıl seçimi PAYMENTS_FILTER
  // durum nesnesinde tutulduğu için oradan okunur; DOM'dan okunsaydı sayfa ilk açıldığında
  // (henüz #yearFilter/#monthFilter oluşmamışken) filtre sessizce 'Tüm aylar/yıllar'a
  // düşüyor ve seçili ay görünse de veriler genel (tüm zamanlar) geliyordu.
  const q=(document.getElementById('search')?.value||'').toLocaleLowerCase('tr-TR');
  const y=type==='payments'?PAYMENTS_FILTER.year:(document.getElementById('yearFilter')?.value||'all');
  const m=type==='payments'?PAYMENTS_FILTER.month:(document.getElementById('monthFilter')?.value||'all');
  const text=JSON.stringify(r).toLocaleLowerCase('tr-TR');if(q&&!text.includes(q))return false;const k=r.monthKey||r.dateKey||'';if(y!=='all'&&k.slice(0,4)!==String(y))return false;if(m!=='all'&&k.slice(5,7)!==String(Number(m)+1).padStart(2,'0'))return false;return true}
function renderStudents(){const rows=DATA.students||[];const q=(document.getElementById('studentSearch')?.value||'').toLocaleLowerCase('tr-TR');const filtered=rows.filter(s=>!q||JSON.stringify(s).toLocaleLowerCase('tr-TR').includes(q));document.getElementById('content').innerHTML=`<div class="card tableCard"><div class="tableTop"><div class="pageTools" style="width:100%"><div class="search"><span>🔎</span><input id="studentSearch" value="${esc(q)}" autocomplete="off" spellcheck="false" placeholder="Öğrenci / ID / telefon / grup ara…" oninput="studentSearchChanged(this.value)"></div><button class="btn addStudent" onclick="openStudentForm()">＋ Öğrenci Ekle</button><button class="btn small" onclick="openSheet('ÖĞRENCİLER')">Sheet'i Aç</button><b class="muted">${filtered.length} öğrenci</b></div></div><div class="tableWrap"><table><thead><tr><th>ID</th><th>Öğrenci</th><th>Branş</th><th>Grup</th><th>Durum</th><th>Aylık Ücret</th><th>Bu Ay Ödenen</th><th>Kalan</th><th>Yıllık Ödenen</th><th>İşlem</th></tr></thead><tbody>${filtered.map(s=>`<tr class="studentRow ${s.status==='Pasif'?'passive':''}"><td><b>${esc(s.id)}</b></td><td><b>${esc(s.name)}</b><br><small class="muted">${esc(s.phone||'')} · ${esc(s.parent||'')}</small></td><td>${colorTag(s.branch)}</td><td>${colorTag(s.group)}</td><td><span class="badge ${s.status==='Pasif'?'bred':'bgreen'}">${esc(s.status)}</span></td><td>${money(s.netFee)}</td><td>${money(s.monthPaid)}</td><td><b style="color:${s.monthRemaining?'var(--red)':'var(--green)'}">${money(s.monthRemaining)}</b></td><td>${money(s.annualPaid)}</td><td><button class="btn small primary" onclick="detail('${esc(s.id)}')">Detay</button></td></tr>`).join('')||'<tr><td colspan="10" class="empty">Öğrenci bulunamadı.</td></tr>'}</tbody></table></div></div>`}
function studentSearchChanged(value){const input=document.getElementById('studentSearch');const pos=input?input.selectionStart:null;const box=document.getElementById('content');const scroll=box?box.scrollTop:0;renderStudents();const n=document.getElementById('studentSearch');if(n){n.focus();try{n.setSelectionRange(pos===null?n.value.length:pos,pos===null?n.value.length:pos)}catch(e){}}if(box)box.scrollTop=scroll}
function renderPayments(){
  // Pasif öğrencilerin eski ödeme kayıtları sistemde kalabilir; ancak
  // ödeme ekranında yalnızca Aktif öğrencilerin kayıtları gösterilir.
  const activeIds=new Set((DATA.students||[])
    .filter(s=>String(s.status||'Aktif')!=='Pasif')
    .map(s=>s.id));
  const rows=(DATA.rawPayments||[])
    .filter(r=>activeIds.has(r.studentId))
    .filter(r=>passFilter(r,'payments'))
    .sort((a,b)=>{
      // paymentDateKey = gerçek ödeme tarihi (yyyy-MM-dd).
      // Görsel dd.MM.yyyy metnini karşılaştırmak yerine ISO tarih anahtarı
      // kullanıldığı için 17.08.2026, 16.08.2026'nın üstünde kesin olarak yer alır.
      const da=String(a.paymentDateKey||'');
      const db=String(b.paymentDateKey||'');
      if (da!==db) return db.localeCompare(da);
      // Aynı gün birden fazla kayıt varsa, Sheet'e en son eklenen satır üstte.
      return (Number(b.paymentRow)||0)-(Number(a.paymentRow)||0);
    });
  const total=rows.reduce((a,r)=>a+r.paid,0),remaining=rows.reduce((a,r)=>a+r.remaining,0);
  document.getElementById('content').innerHTML=`<div class="grid kpi" style="grid-template-columns:repeat(4,1fr)">${card('💰','green','Filtrelenen Tahsilat',money(total),rows.length+' kayıt')}${card('⏳','amberbg','Kayıt Kalanı',money(remaining),'Sheet kayıtları')}${card('💵','green','Nakit',money(rows.filter(r=>r.method==='Nakit').reduce((a,r)=>a+r.paid,0)),'Gerçek yöntem')}${card('🏦','blue','Havale/EFT',money(rows.filter(r=>r.method==='Havale/EFT').reduce((a,r)=>a+r.paid,0)),'Gerçek yöntem')}</div><div class="card tableCard">${filterBar('payments')}<div class="tableWrap"><table><thead><tr><th>Kayıt ID</th><th>Öğrenci</th><th>Ödeme Ayı</th><th>Ödeme Tarihi</th><th>Gereken</th><th>Ödenen</th><th>Kalan</th><th>Yöntem</th><th>Durum</th><th>Not</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.recordId)}</td><td><b>${esc(r.studentName)}</b><br><small>${esc(r.studentId)}</small></td><td>${esc(r.month)}</td><td>${esc(r.paymentDate)}</td><td>${money(r.required)}</td><td style="color:var(--green);font-weight:700">${money(r.paid)}</td><td style="color:var(--amber);font-weight:700">${money(r.remaining)}</td><td>${esc(r.method||'Belirtilmemiş')}</td><td><span class="badge ${r.status==='Ödendi'?'bgreen':r.status==='Kısmi'?'bamber':'bred'}">${esc(r.status)}</span></td><td>${esc(r.note)}</td></tr>`).join('')||'<tr><td colspan="10" class="empty">Ödeme kaydı yok.</td></tr>'}</tbody></table></div></div>`
}
function renderAnnual(){
  const yEl=document.getElementById('yearFilter'); const mEl=document.getElementById('monthFilter');
  const y=yEl?.value&&yEl.value!=='all'?Number(yEl.value):DATA.year;
  const selectedMonth=mEl?.value&&mEl.value!=='all'?Number(mEl.value):null;
  const q=(document.getElementById('search')?.value||'').toLocaleLowerCase('tr-TR');
  const students=(DATA.students||[])
    .filter(s=>String(s.status||'Aktif')!=='Pasif')
    .filter(s=>!q||JSON.stringify(s).toLocaleLowerCase('tr-TR').includes(q));
  const activeIds=new Set(students.map(s=>s.id));
  const payments=(DATA.rawPayments||[])
    .filter(p=>activeIds.has(p.studentId))
    .filter(p=>p.monthKey&&Number(p.monthKey.slice(0,4))===y);
  const rows=students.map(s=>{
    const mp=payments.filter(p=>p.studentId===s.id); const monthsPaid=Array(12).fill(0);
    mp.forEach(p=>{const mi=Number(p.monthKey.slice(5,7))-1;if(mi>=0&&mi<12)monthsPaid[mi]+=Number(p.paid)||0});
    const annualPaid=monthsPaid.reduce((a,b)=>a+b,0), required=Number(s.netFee||0)*12, remaining=Math.max(0,required-annualPaid);
    return {s,monthsPaid,annualPaid,required,remaining,paidCount:monthsPaid.filter(v=>v>0).length};
  });
  const filtered=selectedMonth===null?rows:rows.filter(r=>r.monthsPaid[selectedMonth]>0);
  const monthTotals=Array(12).fill(0); payments.forEach(p=>{const mi=Number(p.monthKey.slice(5,7))-1;if(mi>=0)monthTotals[mi]+=Number(p.paid)||0});
  const totalPaid=payments.reduce((a,p)=>a+(Number(p.paid)||0),0);
  const monthCards=months.map((m,i)=>`<div style="padding:12px;border:1px solid ${selectedMonth===i?'var(--gold)':'var(--line)'};border-radius:12px;background:${selectedMonth===i?'rgba(224,177,60,.12)':'var(--card2)'}"><div style="font-size:12px;color:var(--muted)">${m}</div><b style="font-size:17px;color:${monthTotals[i]>0?'var(--green)':'var(--text)'}">${money(monthTotals[i])}</b><div style="font-size:11px;color:var(--muted)">${rows.filter(r=>r.monthsPaid[i]>0).length} öğrenci</div></div>`).join('');
  const monthCells=r=>r.monthsPaid.map((v,i)=>`<td style="min-width:86px"><span class="badge ${v>0?'bgreen':'bred'}">${v>0?money(v):'Ödeme yok'}</span></td>`).join('');
  document.getElementById('content').innerHTML=`<div class="grid kpi" style="grid-template-columns:repeat(4,1fr)">${card('📅','blue','Yıl',y,'Aylık ödeme takibi')}${card('💳','green','Yıllık Ödenen',money(totalPaid),'Ödeme Ayı üzerinden')}${card('👥','cyanbg','Ödeme Yapan',new Set(payments.filter(p=>p.paid>0).map(p=>p.studentId)).size,'Bu yıl')}${card('📌','amberbg','Eksik Ay',rows.reduce((a,r)=>a+(12-r.paidCount),0),'Öğrenci toplamı')}</div><div class="card" style="margin-bottom:15px"><div class="cardHead"><h3>Ay Ay Tahsilat</h3><span class="muted">Bir aya tıklamak için üstteki ay filtresini kullan</span></div><div class="grid" style="grid-template-columns:repeat(6,minmax(0,1fr))">${monthCards}</div></div><div class="card tableCard">${filterBar('annual')}<div class="tableWrap"><table><thead><tr><th>Öğrenci</th>${months.map(m=>`<th>${m}</th>`).join('')}<th>Yıllık Ödenen</th><th>Kalan</th><th>Durum</th></tr></thead><tbody>${filtered.map(r=>`<tr><td><button class="btn small" onclick="detail('${esc(r.s.id)}')">${esc(r.s.name)}</button><br><small>${esc(r.s.id)}</small></td>${monthCells(r)}<td style="font-weight:700;color:var(--green)">${money(r.annualPaid)}</td><td style="font-weight:700;color:${r.remaining?'var(--red)':'var(--green)'}">${money(r.remaining)}</td><td><span class="badge ${r.remaining?'bamber':'bgreen'}">${r.remaining?'Eksik':'Tamam'}</span></td></tr>`).join('')||'<tr><td colspan="16" class="empty">Seçilen dönemde kayıt yok.</td></tr>'}</tbody></table></div></div>`;
}
function renderExpenses(){const rows=(DATA.rawExpenses||[]).filter(r=>passFilter(r,'expenses'));const total=rows.reduce((a,r)=>a+r.amount,0);document.getElementById('content').innerHTML=`<div class="grid kpi" style="grid-template-columns:repeat(3,1fr)">${card('💸','redbg','Filtrelenen Gider',money(total),rows.length+' kayıt')}${card('📑','amberbg','En Büyük Kategori',topCat(rows),rows.length?'Dağılım':'—')}${card('🏦','blue','Ortalama',money(rows.length?total/rows.length:0),'Kayıt başı')}</div><div class="card tableCard">${filterBar('expenses')}<div class="tableWrap"><table><thead><tr><th>Kayıt ID</th><th>Tarih</th><th>Kategori</th><th>Açıklama</th><th>Tutar</th><th>Ödeme Yöntemi</th><th>Kaynak</th><th>Not</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.recordId)}</td><td>${esc(r.date)}</td><td><span class="badge bblue">${esc(r.category)}</span></td><td><b>${esc(r.description)}</b></td><td style="color:var(--red);font-weight:700">${money(r.amount)}</td><td>${esc(r.method)}</td><td>${esc(r.source)}</td><td>${esc(r.note)}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">Gider kaydı yok.</td></tr>'}</tbody></table></div></div>`}
function topCat(rows){const x={};rows.forEach(r=>x[r.category]=(x[r.category]||0)+r.amount);const a=Object.entries(x).sort((a,b)=>b[1]-a[1]);return a.length?a[0][0]:'—'}
const weekdays=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
function renderCourses(){
  const rows=(DATA.courses||[]).slice().sort((a,b)=>weekdays.indexOf(a.day)-weekdays.indexOf(b.day)||String(a.start).localeCompare(String(b.start)));
  const active=rows.filter(c=>c.active!==false).length;
  document.getElementById('content').innerHTML=`<div class="grid kpi" style="grid-template-columns:repeat(3,1fr)">${card('🗓️','blue','Toplam Ders',rows.length,'DERSLER sayfası')}${card('🟢','green','Aktif Ders',active,'')}${card('🔴','redbg','Pasif Ders',rows.length-active,'')}</div><div class="card tableCard"><div class="tableTop"><b>Haftalık Program</b><span style="flex:1"></span><button class="btn small addStudent" onclick="openCourseForm()">＋ Ders Ekle</button><button class="btn small" onclick="openSheet('DERSLER')">Sheet'i Aç</button></div><div class="tableWrap"><table><thead><tr><th>Gün</th><th>Saat</th><th>Branş</th><th>Grup</th><th>Antrenör</th><th>Durum</th><th>Not</th><th></th></tr></thead><tbody>${rows.map(c=>`<tr class="${c.active===false?'inactiveRow':''}"><td><b>${esc(c.day)}</b></td><td>${esc(c.start||'—')}${c.end?' - '+esc(c.end):''}</td><td>${colorTag(c.branch)}</td><td>${colorTag(c.group)}</td><td>${esc(c.coach||'—')}</td><td><span class="badge ${c.active===false?'bred':'bgreen'}">${c.active===false?'Pasif':'Aktif'}</span></td><td>${esc(c.note||'')}</td><td style="display:flex;gap:5px"><button class="btn small" onclick='openCourseForm(${JSON.stringify(c).replace(/'/g,"&#39;")})'>Düzenle</button><button class="btn small ${c.active===false?'green':''}" onclick="toggleCourse('${esc(c.id)}',${c.active===false})">${c.active===false?'Aktifleştir':'Pasifleştir'}</button><button class="btn small red" onclick="deleteCourse('${esc(c.id)}')">Sil</button></td></tr>`).join('')||'<tr><td colspan="8" class="empty">Henüz ders eklenmemiş.</td></tr>'}</tbody></table></div></div>`;
}
function openCourseForm(c){
  c=c||{};
  const branchOpts=(DATA.branches||[]).map(x=>`<option ${c.branch===x?'selected':''}>${esc(x)}</option>`).join('');
  const groupOpts=(DATA.groupsList||[]).map(x=>`<option ${c.group===x?'selected':''}>${esc(x)}</option>`).join('');
  const dayOpts=weekdays.map(x=>`<option ${c.day===x?'selected':''}>${esc(x)}</option>`).join('');
  form(c.id?'Ders Düzenle':'Ders Ekle',`<h3>🗓️ ${c.id?'Ders Düzenle':'Yeni Ders'}</h3><div class="formGrid"><div class="field"><label>Branş</label><select id="cBranch">${branchOpts}</select></div><div class="field"><label>Grup</label><select id="cGroup">${groupOpts}</select></div><div class="field"><label>Gün</label><select id="cDay">${dayOpts}</select></div><div class="field"><label>Antrenör</label><input id="cCoach" value="${esc(c.coach||'')}"></div><div class="field"><label>Başlangıç Saati</label><input id="cStart" type="time" value="${esc(c.start||'')}"></div><div class="field"><label>Bitiş Saati</label><input id="cEnd" type="time" value="${esc(c.end||'')}"></div><div class="field full"><label>Not</label><input id="cNote" value="${esc(c.note||'')}"></div></div><div class="formActions"><button class="btn" onclick="closeForm()">Vazgeç</button><button class="btn primary" onclick="saveCourse('${esc(c.id||'')}')">Kaydet</button></div>`);
}
function saveCourse(id){callForm('panelV2DersKaydet',[id||null,document.getElementById('cBranch').value,document.getElementById('cGroup').value,document.getElementById('cDay').value,document.getElementById('cStart').value,document.getElementById('cEnd').value,document.getElementById('cCoach').value,document.getElementById('cNote').value],r=>{closeForm();toast(r.message);refreshQuiet()})}
function toggleCourse(id,makeActive){call('panelV2DersDurumDegistir',[id,makeActive],r=>{toast(r.message);refreshQuiet()})}
function deleteCourse(id){if(!confirm('Bu dersi silmek istediğinize emin misiniz?'))return;call('panelV2DersSil',[id],r=>{toast(r.message);refreshQuiet()})}

/* ============================================================
   GELİŞİM RAPORLARI (AŞAMA 1-2)
   Panel, hangi branşın hangi alanlara sahip olduğunu bilmez;
   backend'den gelen şemaya (schema) göre formu ve tabloyu
   otomatik kurar. Yeni branş/kolon eklendiğinde bu dosyada
   hiçbir değişiklik gerekmez.
   ============================================================ */
let REPORTS_STUDENT=null;      // Gelişim Raporları sayfasında seçili öğrenci id'si
let REPORTS_CACHE={};          // studentId -> {schema, reports}

function renderReports(){
  const rows=(DATA.students||[]).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'tr'));
  const q=(document.getElementById('reportsStudentSearch')?.value||'').toLocaleLowerCase('tr-TR');
  const filtered=rows.filter(s=>!q||JSON.stringify(s).toLocaleLowerCase('tr-TR').includes(q));

  document.getElementById('content').innerHTML=`
    <div class="card tableCard">
      <div class="tableTop"><div class="pageTools" style="width:100%">
        <div class="search"><span>🔎</span><input id="reportsStudentSearch" value="${esc(q)}" autocomplete="off" spellcheck="false" placeholder="Rapor görmek istediğiniz öğrenciyi arayın…" oninput="reportsStudentSearchChanged(this.value)"></div>
        <b class="muted">${filtered.length} öğrenci</b>
      </div></div>
      <div class="tableWrap"><table><thead><tr><th>ID</th><th>Öğrenci</th><th>Branş</th><th>Grup</th><th>Durum</th><th></th></tr></thead><tbody>
        ${filtered.map(s=>`<tr class="studentRow ${s.status==='Pasif'?'passive':''}">
          <td><b>${esc(s.id)}</b></td>
          <td><b>${esc(s.name)}</b></td>
          <td>${colorTag(s.branch)}</td>
          <td>${colorTag(s.group)}</td>
          <td><span class="badge ${s.status==='Pasif'?'bred':'bgreen'}">${esc(s.status)}</span></td>
          <td><button class="btn small primary" onclick="openReportsForStudent('${esc(s.id)}')">Gelişim Raporları</button></td>
        </tr>`).join('')||'<tr><td colspan="6" class="empty">Öğrenci bulunamadı.</td></tr>'}
      </tbody></table></div>
    </div>
    <div id="reportsPanel"></div>`;

  if(REPORTS_STUDENT) openReportsForStudent(REPORTS_STUDENT);
}
function reportsStudentSearchChanged(v){renderReports();setTimeout(()=>{const el=document.getElementById('reportsStudentSearch');if(el){el.focus();el.value=v;el.setSelectionRange(v.length,v.length)}},0)}

function openReportsForStudent(studentId){
  REPORTS_STUDENT=studentId;
  const student=(DATA.students||[]).find(s=>s.id===studentId);
  if(!student)return;

  const panel=document.getElementById('reportsPanel');
  if(!panel)return;

  const cached=REPORTS_CACHE[studentId];
  panel.innerHTML=reportsPanelHtml(student,cached);

  call('panelV3GelisimRaporlariGetir',[studentId],d=>{
    if(!d||d.ok===false){toast(d&&d.message||'Gelişim raporları alınamadı.');return}
    REPORTS_CACHE[studentId]=d;
    if(REPORTS_STUDENT!==studentId)return;
    document.getElementById('reportsPanel').innerHTML=reportsPanelHtml(student,d);
  });
}

function reportsPanelHtml(student,d){
  if(!d){
    return `<div class="card" style="margin-top:12px"><div class="loading" style="height:120px"><div><div class="spinner"></div></div></div></div>`;
  }
  if(!d.sheetName){
    return `<div class="card" style="margin-top:12px;padding:18px">
      <h3 class="sectionTitle" style="margin-top:0">${esc(student.name)} · Gelişim Raporları</h3>
      <div class="passiveNotice">⚠️ ${esc(d.message||'Bu branş için gelişim raporu sayfası tanımlı değil.')}</div>
    </div>`;
  }

  const rows=d.reports||[];
  return `<div class="card" style="margin-top:12px;padding:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <h3 class="sectionTitle" style="margin:0">${esc(student.name)} · Gelişim Raporları (${esc(student.branch)})</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn small" ${rows.length?'':'disabled'} onclick="printAllReports('${esc(student.id)}')">📄 Tümünü Yazdır / PDF</button>
        <button class="btn small addStudent" onclick='openReportForm(${JSON.stringify(student).replace(/'/g,"&#39;")})'>＋ Yeni Rapor</button>
      </div>
    </div>
    <div class="tableWrap" style="margin-top:12px"><table><thead><tr><th>Tarih</th>${(d.schema||[]).slice(0,3).map(f=>`<th>${esc(f.label)}</th>`).join('')}<th></th></tr></thead><tbody>
      ${rows.map(r=>`<tr>
        <td>${esc(r.createdAt||'—')}</td>
        ${(d.schema||[]).slice(0,3).map(f=>`<td>${esc(r[f.key]||'—')}</td>`).join('')}
        <td style="display:flex;gap:5px">
          <button class="btn small" onclick="printReport('${esc(student.branch)}','${esc(r.recordId)}')">Yazdır / PDF</button>
          <button class="btn small red" onclick="deleteReport('${esc(student.branch)}','${esc(r.recordId)}','${esc(student.id)}')">Sil</button>
        </td>
      </tr>`).join('')||`<tr><td colspan="${(d.schema||[]).slice(0,3).length+2}" class="empty">Henüz gelişim raporu yok.</td></tr>`}
    </tbody></table></div>
  </div>`;
}

function openReportForm(student){
  call('panelV3GelisimRaporSemasi',[student.branch],res=>{
    if(!res||res.ok===false){toast(res&&res.message||'Rapor şeması alınamadı.');return}
    const fields=(res.schema||[]).map(f=>`
      <div class="field${/açıklama|not|değerlendirme|hedef/i.test(f.label)?' full':''}">
        <label>${esc(f.label)}</label>
        ${/açıklama|not|değerlendirme|hedef/i.test(f.label)
          ?`<textarea id="rf_${esc(f.key)}" rows="3"></textarea>`
          :`<input id="rf_${esc(f.key)}">`}
      </div>`).join('');

    form('Yeni Gelişim Raporu',`
      <h3>🏅 ${esc(student.name)} · Yeni Gelişim Raporu</h3>
      <p class="muted" style="margin:5px 0 16px">Branş: ${esc(student.branch)} · Alanlar bu branşın rapor sayfasındaki başlıklardan otomatik oluşturulur.</p>
      <div class="formGrid" id="reportFormFields">${fields||'<p class="muted">Bu sayfada branşa özel alan tanımlı değil.</p>'}</div>
      <div class="formActions">
        <button class="btn" onclick="closeForm()">Vazgeç</button>
        <button id="saveReportBtn" class="btn addStudent" onclick="saveReport('${esc(student.id)}')">Raporu Kaydet</button>
      </div>`);
  });
}

function saveReport(studentId){
  const btn=document.getElementById('saveReportBtn');
  const fieldEls=document.querySelectorAll('#reportFormFields [id^="rf_"]');
  const fields={};
  fieldEls.forEach(el=>{fields[el.id.replace(/^rf_/,'')]=el.value});

  if(btn){btn.disabled=true;btn.classList.add('isBusy');btn.textContent='Kaydediliyor…';}

  google.script.run
    .withSuccessHandler(function(r){
      if(btn){btn.disabled=false;btn.classList.remove('isBusy');btn.textContent='Raporu Kaydet';}
      if(!r||r.ok===false){toast(r&&r.message||'Rapor kaydedilemedi.');return}
      closeForm();toast(r.message);
      delete REPORTS_CACHE[studentId];
      openReportsForStudent(studentId);
    })
    .withFailureHandler(function(e){
      if(btn){btn.disabled=false;btn.classList.remove('isBusy');btn.textContent='Raporu Kaydet';}
      toast('Hata: '+(e&&e.message?e.message:e));
    })
    .panelV3GelisimRaporKaydet({studentId:studentId,fields:fields});
}

function deleteReport(branch,reportId,studentId){
  if(!confirm('Bu gelişim raporunu silmek istediğinize emin misiniz?'))return;
  call('panelV3GelisimRaporSil',[branch,reportId],r=>{
    toast(r.message);
    delete REPORTS_CACHE[studentId];
    if(REPORTS_STUDENT===studentId) openReportsForStudent(studentId);
  });
}

function printReport(branch,reportId){
  call('panelV3GelisimRaporYazdirilabilirHtml',[branch,reportId],html=>{
    const w=window.open('','_blank');
    if(!w){toast('Açılır pencere engellendi. Lütfen tarayıcı ayarlarından izin verin.');return}
    w.document.open();w.document.write(html);w.document.close();
  });
}

function printAllReports(studentId){
  call('panelV3GelisimRaporlariTumuYazdirilabilirHtml',[studentId],html=>{
    const w=window.open('','_blank');
    if(!w){toast('Açılır pencere engellendi. Lütfen tarayıcı ayarlarından izin verin.');return}
    w.document.open();w.document.write(html);w.document.close();
  });
}

let ATT_QUICK={branch:'__all',group:'__all',date:null};
function renderQuickAttendanceCard(){
  if(!ATT_QUICK.date) ATT_QUICK.date=DATA.todayISO||new Date().toISOString().slice(0,10);
  const branchOpts=['<option value="__all">Tüm Branşlar</option>']
    .concat((DATA.branches||[]).map(b=>`<option value="${esc(b)}" ${ATT_QUICK.branch===b?'selected':''}>${esc(b)}</option>`)).join('');
  const groupOpts=['<option value="__all">Tüm Gruplar</option>']
    .concat((DATA.groupsList||[]).map(g=>`<option value="${esc(g)}" ${ATT_QUICK.group===g?'selected':''}>${esc(g)}</option>`)).join('');
  return `<div class="card" style="margin-bottom:14px">
    <div class="cardHead"><h3>⚡ Hızlı Yoklama</h3><span class="muted">Branş ve grup seçip öğrencileri tek dokunuşla işaretleyin</span></div>
    <div class="formGrid" style="margin-bottom:4px">
      <div class="field"><label>Tarih</label><input id="qaDate" type="date" value="${esc(ATT_QUICK.date)}" onchange="quickAttDateChange(this.value)"></div>
      <div class="field"><label>Branş</label><select id="qaBranch" onchange="quickAttFilterChange()">${branchOpts}</select></div>
      <div class="field full"><label>Grup</label><select id="qaGroup" onchange="quickAttFilterChange()">${groupOpts}</select></div>
    </div>
    <div id="qaList" class="pickSheetList" style="max-height:360px;margin-top:8px">${quickAttListHTML()}</div>
  </div>`;
}
function quickAttListHTML(){
  const branch=ATT_QUICK.branch,group=ATT_QUICK.group,date=ATT_QUICK.date;
  const students=(DATA.students||[]).filter(s=>String(s.status||'Aktif')!=='Pasif')
    .filter(s=>branch==='__all'||s.branch===branch)
    .filter(s=>group==='__all'||s.group===group);
  if(!students.length) return '<div class="empty">Bu branş / grupta aktif öğrenci bulunamadı.</div>';
  const statuses=[['Geldi','🟢'],['Gelmedi','🔴'],['İzinli','🟠'],['Raporlu','🟣']];
  return students.map(s=>{
    const rec=(DATA.rawAttendance||[]).find(r=>r.studentId===s.id&&financeDateKey_(r.date)===date);
    const cur=rec?rec.status:'';
    return `<div class="pickItem" style="cursor:default"><span><span class="pName">${esc(s.name)}</span><span class="pSub">${esc(s.branch||'')} · ${esc(s.group||'')}${cur?' · Şu an: '+esc(cur):''}</span></span><span style="display:flex;gap:4px;flex-wrap:wrap">${statuses.map(([st,ic])=>`<button class="btn small ${cur===st?'primary':''}" onclick="quickMarkAttendance('${esc(s.id)}','${st}',this)" title="${st}">${ic}</button>`).join('')}</span></div>`;
  }).join('');
}
function quickAttFilterChange(){
  ATT_QUICK.branch=document.getElementById('qaBranch')?.value||'__all';
  ATT_QUICK.group=document.getElementById('qaGroup')?.value||'__all';
  const list=document.getElementById('qaList');if(list)list.innerHTML=quickAttListHTML();
}
function quickAttDateChange(v){
  ATT_QUICK.date=v||ATT_QUICK.date;
  const list=document.getElementById('qaList');if(list)list.innerHTML=quickAttListHTML();
}
let _attSyncTimer=null;
function quickMarkAttendance(id,status,btn){
  if(btn){btn.classList.add('isBusy');btn.disabled=true;}
  google.script.run
    .withSuccessHandler(r=>{
      /* Yerel iyimser güncelleme: kaydedildikten sonra tüm veri setini
         yeniden çekmek yerine sadece bu listeyi anında tazeleriz.
         Aggregat sayılar (Genel Bakış, Katılım tablosu vb.) kısa bir
         gecikmeyle arka planda sessizce senkronize edilir. */
      const s=(DATA.students||[]).find(x=>x.id===id);
      const arr=DATA.rawAttendance||(DATA.rawAttendance=[]);
      const iso=ATT_QUICK.date;
      let rec=arr.find(r2=>r2.studentId===id&&financeDateKey_(r2.date)===iso);
      if(rec){rec.status=status;}
      else{arr.unshift({recordId:'',date:iso,dateKey:iso.slice(0,7),studentId:id,studentName:s?s.name:'',branch:s?s.branch:'',group:s?s.group:'',status:status,note:''});}
      delete DETAIL_CACHE[id];
      const list=document.getElementById('qaList');if(list)list.innerHTML=quickAttListHTML();
      clearTimeout(_attSyncTimer);
      _attSyncTimer=setTimeout(()=>{if(PAGE==='attendance')refreshQuiet();},1200);
    })
    .withFailureHandler(e=>{if(btn){btn.disabled=false;btn.classList.remove('isBusy');}toast('Hata: '+(e&&e.message?e.message:e));})
    .panelV2YoklamaKaydet(id,status,ATT_QUICK.date,'');
}
function renderAttendance(){
  const all=DATA.rawAttendance||[]; const yEl=document.getElementById('yearFilter'),mEl=document.getElementById('monthFilter');
  const y=yEl?.value&&yEl.value!=='all'?Number(yEl.value):DATA.year; const m=mEl?.value&&mEl.value!=='all'?Number(mEl.value):null;
  const q=(document.getElementById('search')?.value||'').toLocaleLowerCase('tr-TR');
  const period=all.filter(r=>{const k=r.dateKey||'';return k.slice(0,4)===String(y)&&(m===null||k.slice(5,7)===String(m+1).padStart(2,'0'))});
  const ids=new Set(period.map(r=>r.studentId));
  const students=(DATA.students||[]).filter(s=>{const txt=JSON.stringify(s).toLocaleLowerCase('tr-TR');return !q||txt.includes(q)});
  const stats=students.map(s=>{const rr=period.filter(r=>r.studentId===s.id);return {s,rows:rr,total:rr.length,geldi:rr.filter(r=>r.status==='Geldi').length,gelmedi:rr.filter(r=>r.status==='Gelmedi').length,izinli:rr.filter(r=>r.status==='İzinli').length,raporlu:rr.filter(r=>r.status==='Raporlu').length,rate:rr.length?rr.filter(r=>r.status==='Geldi').length/rr.length*100:0};});
  const totalLessons=period.length,geldi=period.filter(r=>r.status==='Geldi').length,gelmedi=period.filter(r=>r.status==='Gelmedi').length,izinli=period.filter(r=>r.status==='İzinli').length,raporlu=period.filter(r=>r.status==='Raporlu').length,rate=totalLessons?geldi/totalLessons*100:0;
  const detailRows=period.slice().sort((a,b)=>String(b.dateKey).localeCompare(String(a.dateKey))).map(r=>`<tr><td>${esc(r.date)}</td><td><b>${esc(r.studentName)}</b><br><small>${esc(r.studentId)}</small></td><td>${esc(r.branch)}</td><td>${esc(r.group)}</td><td><span class="badge ${r.status==='Geldi'?'bgreen':r.status==='Gelmedi'?'bred':r.status==='İzinli'?'bamber':'bblue'}">${esc(r.status)}</span></td><td>${esc(r.note||'')}</td></tr>`).join('');
  document.getElementById('content').innerHTML=`${renderQuickAttendanceCard()}<div class="card tableCard"><div class="cardHead"><h3>Öğrenci Bazlı Katılım</h3><span class="muted">73 geldi gibi tek sayı yerine her öğrencinin ders, devamsızlık ve oranı ayrı gösterilir.</span></div>${filterBar('attendance')}<div class="tableWrap"><table><thead><tr><th>Öğrenci</th><th>Toplam Ders</th><th>Geldi</th><th>Gelmedi</th><th>İzinli</th><th>Raporlu</th><th>Katılım</th><th></th></tr></thead><tbody>${stats.map(x=>`<tr class="${x.s.status==='Pasif'?'inactiveRow':''}"><td><b>${esc(x.s.name)}</b><br><small>${esc(x.s.id)} · ${esc(x.s.group)}</small></td><td>${x.total}</td><td style="color:var(--green);font-weight:700">${x.geldi}</td><td style="color:var(--red);font-weight:700">${x.gelmedi}</td><td>${x.izinli}</td><td>${x.raporlu}</td><td><b>${x.rate.toFixed(1)}%</b><div style="height:7px;background:rgba(255,255,255,.08);border-radius:8px;margin-top:5px"><div style="height:100%;width:${x.rate}%;background:var(--green);border-radius:8px"></div></div></td><td><button class="btn small" onclick="detail('${esc(x.s.id)}')">Detay</button></td></tr>`).join('')||'<tr><td colspan="8" class="empty">Seçilen dönemde öğrenci yok.</td></tr>'}</tbody></table></div></div><div class="card tableCard" style="margin-top:15px"><div class="tableTop"><b>Yoklama Hareketleri</b><span class="muted">Gerçek YOKLAMA KAYITLARI</span></div><div class="tableWrap" style="max-height:380px"><table><thead><tr><th>Tarih</th><th>Öğrenci</th><th>Branş</th><th>Grup</th><th>Durum</th><th>Not</th></tr></thead><tbody>${detailRows||'<tr><td colspan="6" class="empty">Seçilen dönemde yoklama kaydı yok.</td></tr>'}</tbody></table></div></div>`;
}
function renderFinance(){
  // GELİR: gerçek ödeme kayıtları
  const incomeRows=(DATA.rawPayments||[])
    .filter(p=>Number(p.paid||0)>0)
    .map(p=>({
      recordId:p.recordId||'',
      date:p.paymentDate||'',
      dateKey:financeDateKey_(p.paymentDate),
      type:'Gelir',
      category:'Öğrenci Ödemesi',
      description:(p.studentName||'')+(p.month?' - '+p.month:''),
      amount:Number(p.paid||0),
      studentId:p.studentId||'',
      source:'Öğrenci Ödemesi',
      method:p.method||'',
      note:p.note||''
    }));

  // GİDER: gerçek gider kayıtları
  const expenseRows=(DATA.rawExpenses||[]).map(g=>({
    recordId:g.recordId||'',
    date:g.date||'',
    dateKey:g.dateKey||financeDateKey_(g.date),
    type:'Gider',
    category:g.category||'',
    description:g.description||'',
    amount:Number(g.amount||0),
    studentId:'',
    source:g.source||'',
    method:g.method||'',
    note:g.note||''
  }));

  const all=[...incomeRows,...expenseRows];

  const search=(document.getElementById('search')?.value||'')
    .toLocaleLowerCase('tr-TR');
  const year=document.getElementById('yearFilter')?.value||'all';
  const month=document.getElementById('monthFilter')?.value||'all';

  const rows=all.filter(r=>{
    if(search && !JSON.stringify(r).toLocaleLowerCase('tr-TR').includes(search)){
      return false;
    }

    // "Tüm aylar" = bütün kayıtlar.
    // Ay seçildiyse GERÇEK TARİHE göre filtrele.
    const k=r.dateKey||'';

    if(year!=='all' && k.slice(0,4)!==String(year)){
      return false;
    }

    if(month!=='all' && k.slice(5,7)!==String(Number(month)+1).padStart(2,'0')){
      return false;
    }

    return true;
  }).sort((a,b)=>String(b.dateKey||'').localeCompare(String(a.dateKey||'')));

  const income=rows
    .filter(r=>r.type==='Gelir')
    .reduce((sum,r)=>sum+Number(r.amount||0),0);

  const expense=rows
    .filter(r=>r.type==='Gider')
    .reduce((sum,r)=>sum+Number(r.amount||0),0);

  const net=income-expense;

  let period='Tüm kayıtlar';
  if(year!=='all' && month!=='all'){
    period=months[Number(month)]+' '+year;
  }else if(year!=='all'){
    period=year+' · Tüm aylar';
  }

  const tableRows=rows.map(r=>`<tr>
    <td>${esc(r.recordId)}</td>
    <td>${esc(r.date)}</td>
    <td><span class="badge ${r.type==='Gelir'?'bgreen':'bred'}">${r.type}</span></td>
    <td>${esc(r.category)}</td>
    <td><b>${esc(r.description)}</b></td>
    <td style="font-weight:700;color:${r.type==='Gelir'?'var(--green)':'var(--red)'}">
      ${r.type==='Gelir'?'+':'-'}${money(r.amount)}
    </td>
    <td>${esc(r.studentId)}</td>
    <td>${esc(r.source)}</td>
    <td>${esc(r.method)}</td>
    <td>${esc(r.note)}</td>
  </tr>`).join('');

  document.getElementById('content').innerHTML=`
    <div class="grid kpi" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      ${card('📥','green','Gelir',money(income),period)}
      ${card('📤','redbg','Gider',money(expense),period)}
      ${card(
        net>=0?'📈':'📉',
        net>=0?'blue':'redbg',
        'Net Sonuç',
        money(net),
        'Gelir − Gider'
      )}
    </div>

    <div class="card tableCard">
      ${filterBar('finance')}
      <div class="tableTop">
        <b>GELİR / GİDER</b>
        <span class="muted">${esc(period)} · ${rows.length} kayıt</span>
        <span style="flex:1"></span>
        <button class="btn small red" onclick="openExpenseForm()">＋ Gider Ekle</button>
      </div>

      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Kayıt ID</th>
              <th>Tarih</th>
              <th>Tür</th>
              <th>Kategori</th>
              <th>Açıklama</th>
              <th>Tutar</th>
              <th>Öğrenci ID</th>
              <th>Kaynak</th>
              <th>Ödeme Yöntemi</th>
              <th>Not</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows||'<tr><td colspan="10" class="empty">Seçilen dönemde gelir/gider kaydı yok.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function openExpenseForm(){
  const opts=(DATA.paymentMethods||[]).map(x=>`<option>${esc(x)}</option>`).join('');
  form('Gider Ekle',`<h3>💸 Gider Ekle</h3><div class="formGrid"><div class="field"><label>Tarih</label><input id="eDate" type="date" value="${DATA.todayISO||new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Kategori</label><select id="eCategory"><option>Kira</option><option>Maaş</option><option>Fatura</option><option>Malzeme</option><option>Ulaşım</option><option>Reklam</option><option>Banka Komisyonu</option><option>Vergi</option><option>Diğer</option></select></div><div class="field full"><label>Açıklama *</label><input id="eDesc"></div><div class="field"><label>Tutar *</label><input id="eAmount" type="number" min="0" step="0.01"></div><div class="field"><label>Ödeme Yöntemi</label><select id="eMethod"><option value="">Belirtilmemiş</option>${opts}</select></div><div class="field full"><label>Not</label><input id="eNote"></div></div><div class="formActions"><button class="btn" onclick="closeForm()">Vazgeç</button><button class="btn red" onclick="saveExpense()">Kaydet</button></div>`);
}
function saveExpense(){
  const amount=Number(document.getElementById('eAmount').value||0);
  if(!amount||amount<=0){toast('Gider tutarı 0’dan büyük olmalıdır.');return}
  callForm('panelV2GiderKaydet',[document.getElementById('eDate').value,document.getElementById('eCategory').value,document.getElementById('eDesc').value,amount,document.getElementById('eMethod').value,document.getElementById('eNote').value],r=>{closeForm();toast(r.message);refreshQuiet()});
}
function financeDateKey_(value){
  const s=String(value||'').trim();

  // dd.MM.yyyy
  let m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if(m){
    return m[3]+'-'+
      String(Number(m[2])).padStart(2,'0')+'-'+
      String(Number(m[1])).padStart(2,'0');
  }

  // yyyy-MM-dd veya benzeri ISO değerler
  m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m){
    return m[1]+'-'+
      String(Number(m[2])).padStart(2,'0')+'-'+
      String(Number(m[3])).padStart(2,'0');
  }

  return '';
}
/* Öğrenci detayı önbelleği: aynı öğrenci tekrar açıldığında sunucuya
   tekrar gitmeden anında açılır (performans). Ödeme/yoklama/durum
   değişikliğinde ilgili öğrencinin önbelleği temizlenir. */
const DETAIL_CACHE={};
let _detailOpenId=null;
function renderDetailBody(d){
  const isPasif=d.status==='Pasif';
  return `<div class="drawerHead"><div class="drawerHeadRow"><div class="profile"><div class="avatar">${esc((d.name||'?').split(' ').map(x=>x[0]).slice(0,2).join(''))}</div><div><h2 style="margin:0">${esc(d.name)}</h2><div style="opacity:.8;font-size:12px">${esc(d.id)} · ${esc(d.branch)} · ${esc(d.group)}</div></div></div><button class="close" onclick="closeDetail()">×</button></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn small" style="background:rgba(255,255,255,.14);color:#fff;border-color:transparent" onclick='openStudentForm(${JSON.stringify(d).replace(/'/g,"&#39;")})'>✏️ Düzenle</button><button class="btn small ${isPasif?'green':'red'}" onclick="toggleStudentStatus('${esc(d.id)}',${isPasif})">${isPasif?'Aktifleştir':'Pasifleştir'}</button></div></div><div class="drawerBody"><div class="infoGrid">${info('Durum',d.status)}${info('Telefon',d.phone)}${info('Veli',d.parent)}${info('Doğum',d.dob)}${info('Yaş',d.age)}${info('Kayıt Tarihi',d.registrationDate)}${info('Aylık Ücret',money(d.netFee))}${info('Ödeme Günü',d.paymentDay)}${info('İndirim',money(d.discount))}${info('Not',d.notes)}</div><h3 class="sectionTitle">Bu Ay · ${esc(d.currentMonth.label)}</h3><div class="grid cols2">${info('Gereken',money(d.currentMonth.required))}${info('Ödenen',money(d.currentMonth.paid))}${info('Kalan',money(d.currentMonth.remaining))}${info('Durum',d.currentMonth.status)}</div>${isPasif?'<div class="passiveNotice">⚠️ Bu öğrenci <b>Pasif</b>. Pasif öğrenciler için yeni ödeme/yoklama kaydı girilemez. Geçmiş kayıtları aşağıda görüntülenmeye devam eder.</div>':''}<div class="quick" style="margin-top:12px"><button ${isPasif?'disabled title="Pasif öğrenci için işlem yapılamaz"':''} onclick="openPayment('${esc(d.id)}')">💳 Ödeme Kaydet</button><button ${isPasif?'disabled title="Pasif öğrenci için işlem yapılamaz"':''} onclick="openAttendance('${esc(d.id)}')">📋 Yoklama Kaydet</button><button onclick="openSheet('ÖDEME KAYITLARI')">💰 Ödeme Kayıtları</button><button onclick="openSheet('YOKLAMA KAYITLARI')">📝 Yoklama Kayıtları</button><button onclick="openStudentReportsFromDetail('${esc(d.id)}')">🏅 Gelişim Raporları</button></div><h3 class="sectionTitle">Yıllık Ödeme · ${d.annual.year}</h3><div class="grid cols2">${info('Yıllık Gereken',money(d.annual.required))}${info('Yıllık Ödenen',money(d.annual.paid))}${info('Yıllık Kalan',money(d.annual.remaining))}${info('Ödenen Ay',d.annual.paidMonths+'/12')}</div><h3 class="sectionTitle">Yoklama</h3><div class="grid cols2">${info('Bu Ay',attText(d.attendance.month))}${info('Yıllık',attText(d.attendance.year))}${info('Son Yoklama',d.attendance.lastDate)}</div><h3 class="sectionTitle">Ödeme Geçmişi</h3>${paymentTable(d.payments)}<h3 class="sectionTitle">Yoklama Geçmişi</h3>${attendanceTable(d.attendanceRows)}</div>`;
}
function detail(id){
  _detailOpenId=id;
  document.getElementById('detail').classList.add('open');
  const cached=DETAIL_CACHE[id];
  if(cached){
    DETAIL=cached;
    document.getElementById('detailContent').innerHTML=renderDetailBody(cached);
  } else {
    document.getElementById('detailContent').innerHTML='<div class="loading" style="height:40vh"><div><div class="spinner"></div></div></div>';
  }
  call('panelV2OgrenciDetay',[id],d=>{
    if(!d){if(!cached){toast('Öğrenci bulunamadı');closeDetail();}return}
    DETAIL_CACHE[id]=d;
    if(_detailOpenId!==id)return; // kullanıcı bu arada başka bir öğrenciye geçtiyse eski cevabı yazma
    DETAIL=d;
    document.getElementById('detailContent').innerHTML=renderDetailBody(d);
  });
}
function info(k,v){return `<div class="info"><label>${esc(k)}</label><b>${esc(v??'—')}</b></div>`}function attText(x){return `${x.total} ders · ${x.geldi} geldi · ${x.gelmedi} gelmedi · ${x.izinli} izinli · %${x.rate.toFixed(1)}`}function paymentTable(rows){return `<div class="tableWrap" style="max-height:240px"><table><thead><tr><th>Ay</th><th>Tarih</th><th>Tutar</th><th>Yöntem</th><th>Durum</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.month)}</td><td>${esc(r.paymentDate)}</td><td>${money(r.paid)}</td><td>${esc(r.method)}</td><td>${esc(r.status)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Ödeme geçmişi yok.</td></tr>'}</tbody></table></div>`}function attendanceTable(rows){return `<div class="tableWrap" style="max-height:240px"><table><thead><tr><th>Tarih</th><th>Branş</th><th>Grup</th><th>Durum</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.branch)}</td><td>${esc(r.group)}</td><td>${esc(r.status)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">Yoklama geçmişi yok.</td></tr>'}</tbody></table></div>`}
function closeDetail(){document.getElementById('detail').classList.remove('open');_detailOpenId=null}
function openStudentReportsFromDetail(id){closeDetail();closeMore();go('reports');setTimeout(()=>openReportsForStudent(id),0)}
function openSheet(n){call('acSheet',[n],r=>{if(r&&r.url){window.open(r.url,'_blank');toast(n+' sayfası açıldı.')}else{toast(n+' sayfasına geçildi.')}})}
function openWebApp(){const url=(GAS&&GAS.baseUrl)?GAS.baseUrl:'https://script.google.com/macros/s/AKfycbynpk-Vpv6vV_XQftcfNI6A3cP1DdZ2HvWBW5CquBFa_cgAD2iWPth7g5OQ0JrKyzyLhg/exec';window.open(url,'_blank','noopener');}
function form(title,body){document.getElementById('formBox').innerHTML=body;document.getElementById('formModal').classList.add('open')}
function closeForm(){document.getElementById('formModal').classList.remove('open')}

function openStudentForm(s){
  s=s||{};
  const isEdit=!!s.id;
  const branches=(DATA.branches&&DATA.branches.length)?DATA.branches:[];
  const groupsList=(DATA.groupsList&&DATA.groupsList.length)?DATA.groupsList:['Başlangıç','Orta','İleri','Performans'];
  const branchOpts=branches.map(x=>`<option value="${esc(x)}" ${s.branch===x?'selected':''}>${esc(x)}</option>`).join('');
  const groupOpts=groupsList.map(x=>`<option value="${esc(x)}" ${s.group===x?'selected':''}>${esc(x)}</option>`).join('');
  form(isEdit?'Öğrenci Düzenle':'Yeni Öğrenci',`
    <h3>👤 ${isEdit?'Öğrenci Düzenle':'Yeni Öğrenci'}</h3>
    <p class="muted" style="margin:5px 0 16px">${isEdit?'Değişiklikler ilgili tüm sayfalara yansıtılır.':'Yeni kayıt doğrudan Öğrenciler sayfasına ve diğer ilgili sayfalara aktarılır.'}</p>
    <div class="formGrid">
      <div class="field"><label>Ad Soyad *</label><input id="sfName" autocomplete="name" value="${esc(s.name||'')}"></div>
      <div class="field"><label>Telefon</label><input id="sfPhone" inputmode="tel" value="${esc(s.phone||'')}"></div>
      <div class="field"><label>Veli</label><input id="sfParent" value="${esc(s.parent||'')}"></div>
      <div class="field"><label>Doğum Tarihi</label><input id="sfDob" type="date" value="${esc(s.dobIso||'')}"></div>
      <div class="field"><label>Branş</label>
        <select id="sfBranch">${branchOpts}</select>
      </div>
      <div class="field"><label>Grup</label>
        <select id="sfGroup">${groupOpts}</select>
      </div>
      <div class="field"><label>Aylık Ücret</label><input id="sfFee" type="number" min="0" step="0.01" value="${s.monthlyFee!=null?s.monthlyFee:''}"></div>
      <div class="field"><label>İndirim</label><input id="sfDiscount" type="number" min="0" step="0.01" value="${s.discount!=null?s.discount:0}"></div>
      <div class="field"><label>Ödeme Günü</label><input id="sfPaymentDay" type="number" min="1" max="31" value="${s.paymentDayOfMonth||1}"></div>
      <div class="field"><label>Kayıt Tarihi</label><input id="sfRegDate" type="date" value="${s.registrationDateIso||new Date().toISOString().slice(0,10)}" ${isEdit?'disabled':''}></div>
      <div class="field full"><label>Not</label><textarea id="sfNotes" rows="3">${esc(s.notes||'')}</textarea></div>
    </div>
    <div id="studentSaveError" class="formError" style="display:none"></div>
    <div class="formActions">
      <button class="btn" onclick="closeForm()">Vazgeç</button>
      <button id="saveStudentBtn" class="btn addStudent" onclick="saveNewStudent('${esc(s.id||'')}')">${isEdit?'Değişiklikleri Kaydet':'Öğrenciyi Kaydet'}</button>
    </div>`);
  setTimeout(()=>document.getElementById('sfName')?.focus(),50);
}

function saveNewStudent(id){
  const btn=document.getElementById('saveStudentBtn');
  const name=document.getElementById('sfName')?.value.trim();
  if(!name){toast('Ad Soyad zorunludur.');document.getElementById('sfName')?.focus();return}

  const paymentDay=Number(document.getElementById('sfPaymentDay')?.value||1);
  if(paymentDay<1||paymentDay>31){toast('Ödeme günü 1 ile 31 arasında olmalıdır.');document.getElementById('sfPaymentDay')?.focus();return}

  const payload={
    id:id||'',
    name:name,
    phone:document.getElementById('sfPhone')?.value.trim()||'',
    parent:document.getElementById('sfParent')?.value.trim()||'',
    dob:document.getElementById('sfDob')?.value||'',
    branch:document.getElementById('sfBranch')?.value||'',
    group:document.getElementById('sfGroup')?.value||'',
    monthlyFee:Number(document.getElementById('sfFee')?.value||0),
    discount:Number(document.getElementById('sfDiscount')?.value||0),
    paymentDay:String(paymentDay),
    registrationDate:document.getElementById('sfRegDate')?.value||new Date().toISOString().slice(0,10),
    notes:document.getElementById('sfNotes')?.value.trim()||''
  };

  if(btn){btn.disabled=true;btn.classList.add('isBusy');btn.textContent='Kaydediliyor…';}

  google.script.run
    .withSuccessHandler(function(r){
      if(btn){btn.disabled=false;btn.classList.remove('isBusy');btn.textContent=id?'Değişiklikleri Kaydet':'Öğrenciyi Kaydet';}
      if(!r || r.ok===false){showStudentSaveError(r?.message||'Öğrenci kaydedilemedi.');return;}
      closeForm();
      toast(r.message||'Öğrenci başarıyla kaydedildi.');
      if(id)delete DETAIL_CACHE[id];
      if(id&&DETAIL&&DETAIL.id===id){detail(id)}
      call('panelV1MobilOzetGetir',[],function(data){
        DATA=data;syncSide();PAGE='students';document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='students'));
        document.getElementById('pageTitle').textContent='Öğrenciler';
        document.getElementById('pageSub').textContent='Tüm öğrenci bilgileri ve kişisel durumlar';
        render();
      });
    })
    .withFailureHandler(function(e){
      if(btn){btn.disabled=false;btn.classList.remove('isBusy');btn.textContent=id?'Değişiklikleri Kaydet':'Öğrenciyi Kaydet';}
      showStudentSaveError(e&&e.message?e.message:String(e));
    })
    .panelV2OgrenciKaydet(payload);
}

function toggleStudentStatus(id,makeActive){
  const msg=makeActive?'Bu öğrenciyi Aktif yapmak istediğinize emin misiniz?':'Bu öğrenciyi Pasif yapmak istediğinize emin misiniz? Pasif öğrenciler için yeni ödeme/yoklama kaydı girilemez; geçmiş kayıtları korunur.';
  if(!confirm(msg))return;
  call('panelV2OgrenciDurumDegistir',[id,makeActive?'Aktif':'Pasif'],r=>{toast(r.message);delete DETAIL_CACHE[id];if(DETAIL&&DETAIL.id===id){detail(id)}refreshQuiet()});
}

function showStudentSaveError(message){
  const box=document.getElementById('studentSaveError');
  if(box){box.textContent='Kayıt yapılamadı: '+message;box.style.display='block';}
  toast('Öğrenci kaydedilemedi.');
}
/* ============================================================
   HIZLI İŞLEMLER: Ödeme Al / Yoklama Gir / Öğrenci Ara
   Bu bölüm yalnızca panel içi hızlı erişim ekler; mevcut
   openPayment/openAttendance/panelV2* çağrılarını olduğu gibi
   kullanır, hiçbir backend fonksiyonuna dokunmaz.
   ============================================================ */
function quickPaymentPicker(){openQuickPicker('Ödeme Al','payment')}
function quickAttendancePicker(){openQuickPicker('Yoklama Gir','attendance')}
function quickStudentSearch(){
  go('students');
  setTimeout(()=>{
    const el=document.getElementById('studentSearch');
    if(el){el.focus();try{el.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){}}
  },80);
}
function openQuickPicker(title,mode){
  form(title,`<h3>${mode==='payment'?'💳':'📋'} ${esc(title)}</h3><p class="muted" style="margin:5px 0 10px">İşlem yapılacak öğrenciyi seçin.</p><div class="pickSearch"><input id="qpSearch" placeholder="Öğrenci adı / ID ara…" autocomplete="off" oninput="renderQuickPickerList('${mode}')" style="width:100%"></div><div id="qpList" class="pickSheetList"></div><div class="formActions"><button class="btn" onclick="closeForm()">Vazgeç</button></div>`);
  renderQuickPickerList(mode);
  setTimeout(()=>document.getElementById('qpSearch')?.focus(),60);
}
function renderQuickPickerList(mode){
  const q=(document.getElementById('qpSearch')?.value||'').toLocaleLowerCase('tr-TR');
  const rows=(DATA.students||[])
    .filter(s=>String(s.status||'Aktif')!=='Pasif')
    .filter(s=>!q||JSON.stringify(s).toLocaleLowerCase('tr-TR').includes(q))
    .slice(0,60);
  const list=document.getElementById('qpList');
  if(!list)return;
  list.innerHTML=rows.map(s=>`<button class="pickItem" onclick="quickPickStudent('${esc(s.id)}','${mode}')"><span><span class="pName">${esc(s.name)}</span><span class="pSub">${esc(s.branch||'')} · ${esc(s.group||'')}</span></span><span class="muted">${esc(s.id)}</span></button>`).join('') || '<div class="empty">Öğrenci bulunamadı.</div>';
}
function quickPickStudent(id,mode){
  closeForm();
  call('panelV2OgrenciDetay',[id],d=>{
    if(d){DETAIL=d;}
    if(mode==='payment')openPayment(id);else openAttendance(id);
  });
}
function openPayment(id){const opts=(DATA.paymentMethods||[]).map(x=>`<option>${esc(x)}</option>`).join('');form('Ödeme',`<h3>💳 Ödeme Kaydet</h3><p class="muted" style="margin:5px 0 16px">${esc(DETAIL?.name||id)}</p><div class="formGrid"><div class="field"><label>Ödeme Tutarı</label><input id="fAmount" type="number" min="0" step="0.01"></div><div class="field"><label>Ödeme Yöntemi</label><select id="fMethod"><option value="">Belirtilmemiş</option>${opts}</select></div><div class="field"><label>Ödeme Ayı</label><select id="fMonth">${months.map((m,i)=>`<option value="${DATA.year}-${String(i+1).padStart(2,'0')}-01" ${i===DATA.month?'selected':''}>${m}</option>`).join('')}</select></div><div class="field full"><label>Not</label><input id="fNote"></div></div><div class="formActions"><button class="btn" onclick="closeForm()">Vazgeç</button><button class="btn primary" onclick="savePayment('${esc(id)}',this)">Kaydet</button></div>`)}
function savePayment(id,btn){
  if(btn){btn.disabled=true;btn.classList.add('isBusy');}
  google.script.run
    .withSuccessHandler(r=>{closeForm();toast(r.message);delete DETAIL_CACHE[id];refreshQuiet();})
    .withFailureHandler(e=>{if(btn){btn.disabled=false;btn.classList.remove('isBusy');}toast('Hata: '+(e&&e.message?e.message:e));})
    .panelV2OdemeKaydet(id,Number(document.getElementById('fAmount').value),document.getElementById('fMethod').value,document.getElementById('fMonth').value,document.getElementById('fNote').value);
}
function openAttendance(id){form('Yoklama',`<h3>📋 Yoklama Kaydet</h3><p class="muted" style="margin:5px 0 16px">${esc(DETAIL?.name||id)}</p><div class="formGrid"><div class="field"><label>Tarih</label><input id="aDate" type="date" value="${DATA.todayISO||new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Durum</label><select id="aStatus"><option>Geldi</option><option>Gelmedi</option><option>İzinli</option><option>Raporlu</option></select></div><div class="field full"><label>Not</label><input id="aNote"></div></div><div class="formActions"><button class="btn" onclick="closeForm()">Vazgeç</button><button class="btn green" onclick="saveAttendance('${esc(id)}',this)">Kaydet</button></div>`)}
function saveAttendance(id,btn){
  if(btn){btn.disabled=true;btn.classList.add('isBusy');}
  google.script.run
    .withSuccessHandler(r=>{closeForm();toast(r.message);delete DETAIL_CACHE[id];refreshQuiet();})
    .withFailureHandler(e=>{if(btn){btn.disabled=false;btn.classList.remove('isBusy');}toast('Hata: '+(e&&e.message?e.message:e));})
    .panelV2YoklamaKaydet(id,document.getElementById('aStatus').value,document.getElementById('aDate').value,document.getElementById('aNote').value);
}
function tick(){const d=new Date();document.getElementById('clock').textContent=d.toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long'})+' · '+d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}setInterval(tick,1000);tick();boot_();
