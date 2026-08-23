/* ============================================================
   BRIDGE.JS — PWA <-> Google Apps Script köprüsü
   Bu dosya orijinal panel mantığına (app.js) HİÇBİR ŞEKİLDE
   dokunmaz. Tek görevi: google.script.run çağrılarını, Apps
   Script Web App'ine (doPost) yapılan fetch isteklerine
   dönüştürmek. app.js içindeki call()/callForm() ve tüm
   google.script.run.withSuccessHandler(...).withFailureHandler(...).
   fonksiyonAdi(...) zincirleri olduğu gibi çalışmaya devam eder.

   GÜVENLİK NOTU:
   - Web App URL'i ve API TOKEN, bu GitHub deposunda / kodun
     içinde SAKLANMAZ. Kullanıcı ilk açılışta bunları girer,
     yalnızca kendi cihazının localStorage'ında tutulur.
   - Bu depo GitHub Pages gibi herkese açık bir yerde barınsa
     bile, token repo içinde olmadığı için sızmaz.
   - Gerçek yetkilendirme sınırı sunucu tarafındadır: Apps
     Script doPost() içinde token doğrulanmadan hiçbir Sheet
     fonksiyonu çalışmaz.
   - İsteğe bağlı yerel PIN kilidi, paylaşılan/kaybolan cihaz
     senaryosuna karşı ekstra bir katmandır; tek başına güvenlik
     sınırı DEĞİLDİR.
============================================================ */

const GAS = {
  baseUrl: localStorage.getItem('gas_url') || '',
  token: localStorage.getItem('gas_token') || ''
};

function gasConfigured_(){
  return !!(GAS.baseUrl && GAS.token);
}

function gasFetch_(action, args){
  return fetch(GAS.baseUrl, {
    method: 'POST',
    // Bilinçli olarak text/plain kullanılıyor: Apps Script Web App'leri
    // application/json ile gelen preflight (OPTIONS) isteklerini
    // desteklemez. text/plain "simple request" sayıldığı için
    // tarayıcı preflight göndermez ve istek doğrudan ulaşır.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: action, args: args, token: GAS.token })
  })
  .then(function(res){
    if (!res.ok) throw new Error('Sunucu hatası (HTTP ' + res.status + ')');
    return res.json();
  })
  .then(function(json){
    if (!json || json.ok === false) {
      throw new Error((json && json.error) || 'Bilinmeyen sunucu hatası.');
    }
    return json.data;
  });
}

/* google.script.run'ı taklit eden zincirlenebilir proxy.
   app.js içindeki kod hiç değişmeden çalışır:
   google.script.run.withSuccessHandler(f).withFailureHandler(g).fonksiyon(a,b) */
function gasRunner_(onSuccess, onFailure){
  return new Proxy({}, {
    get: function(_target, prop){
      if (prop === 'withSuccessHandler') {
        return function(fn){ return gasRunner_(fn, onFailure); };
      }
      if (prop === 'withFailureHandler') {
        return function(fn){ return gasRunner_(onSuccess, fn); };
      }
      // Buraya düşen her özellik erişimi, Apps Script'teki gerçek
      // fonksiyon adı olarak yorumlanır (ör. .panelV1MobilOzetGetir).
      return function(){
        var args = Array.prototype.slice.call(arguments);
        if (!gasConfigured_()) {
          var e = new Error('Bağlantı ayarları eksik. Lütfen önce Ayarlar\'dan Web App URL ve Token girin.');
          if (onFailure) onFailure(e); else console.error(e);
          openGasSetup_();
          return;
        }
        gasFetch_(String(prop), args)
          .then(function(data){ if (onSuccess) onSuccess(data); })
          .catch(function(e){ if (onFailure) onFailure(e); else console.error(e); });
      };
    }
  });
}

window.google = window.google || {};
window.google.script = window.google.script || {};
window.google.script.run = gasRunner_(null, null);

/* ============================================================
   İLK KURULUM / AYARLAR MODALI
============================================================ */

function gasSetupModalHtml_(){
  return (
    '<div id="gasSetupOverlay" style="position:fixed;inset:0;background:rgba(6,12,24,.92);' +
    'z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;' +
    'font-family:Inter,system-ui,sans-serif;">' +
    '<div style="background:#0f1e36;border:1px solid #22304a;border-radius:16px;max-width:420px;' +
    'width:100%;padding:26px;color:#e7ecf5;box-shadow:0 20px 60px rgba(0,0,0,.5)">' +
    '<h2 style="margin:0 0 6px;font-size:18px">🏆 IŞIK Spor Kulübü</h2>' +
    '<p style="margin:0 0 18px;font-size:13px;color:#8e9cb5;line-height:1.5">' +
    'Panelin çalışması için Google Apps Script Web App bağlantı bilgilerinizi girin. ' +
    'Bu bilgiler yalnızca bu cihazda saklanır, hiçbir sunucuya gönderilmez.</p>' +
    '<label style="font-size:12px;color:#8e9cb5;display:block;margin-bottom:4px">Web App URL (…/exec)</label>' +
    '<input id="gasUrlInput" type="text" placeholder="https://script.google.com/macros/s/XXXX/exec" ' +
    'style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid #2a3a57;' +
    'background:#0a1526;color:#fff;margin-bottom:14px;font-size:13px">' +
    '<label style="font-size:12px;color:#8e9cb5;display:block;margin-bottom:4px">API Token</label>' +
    '<input id="gasTokenInput" type="password" placeholder="Script Properties → API_TOKEN" ' +
    'style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid #2a3a57;' +
    'background:#0a1526;color:#fff;margin-bottom:18px;font-size:13px">' +
    '<div id="gasSetupError" style="display:none;color:#ff7a7a;font-size:12px;margin-bottom:12px"></div>' +
    '<button id="gasSetupSave" style="width:100%;padding:11px;border:0;border-radius:9px;' +
    'background:#2f6bf0;color:#fff;font-weight:700;font-size:14px;cursor:pointer">Kaydet ve Bağlan</button>' +
    '</div></div>'
  );
}

function openGasSetup_(){
  if (document.getElementById('gasSetupOverlay')) return;
  var wrap = document.createElement('div');
  wrap.innerHTML = gasSetupModalHtml_();
  document.body.appendChild(wrap.firstChild);
  document.getElementById('gasUrlInput').value = GAS.baseUrl || '';
  document.getElementById('gasTokenInput').value = GAS.token || '';
  document.getElementById('gasSetupSave').addEventListener('click', function(){
    var url = document.getElementById('gasUrlInput').value.trim();
    var token = document.getElementById('gasTokenInput').value.trim();
    var errBox = document.getElementById('gasSetupError');
    if (!/^https:\/\/script\.google(usercontent)?\.com\/.*\/exec$/.test(url)) {
      errBox.textContent = 'Geçerli bir Web App URL girin (…/exec ile bitmeli).';
      errBox.style.display = 'block';
      return;
    }
    if (!token) {
      errBox.textContent = 'Token boş olamaz.';
      errBox.style.display = 'block';
      return;
    }
    GAS.baseUrl = url;
    GAS.token = token;
    localStorage.setItem('gas_url', url);
    localStorage.setItem('gas_token', token);
    document.getElementById('gasSetupOverlay').remove();
    if (typeof refresh === 'function') refresh();
  });
}

function gasLogout_(){
  if (!confirm('Bu cihazdaki bağlantı bilgilerini silmek istediğinize emin misiniz?')) return;
  localStorage.removeItem('gas_url');
  localStorage.removeItem('gas_token');
  localStorage.removeItem('gas_pin_hash');
  location.reload();
}

/* ============================================================
   İSTEĞE BAĞLI YEREL PIN KİLİDİ
   Not: Bu sadece "cihaz paylaşılıyorsa göz ucuyla bakılmasın"
   diye eklenen pratik bir katmandır; gerçek yetkilendirme
   sınırı her zaman sunucudaki API_TOKEN kontrolüdür.
============================================================ */

async function sha256Hex_(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function pinLockModalHtml_(mode){
  const title = mode === 'set' ? 'Yeni PIN Belirle' : 'PIN Girin';
  return (
    '<div id="gasPinOverlay" style="position:fixed;inset:0;background:#060c18;' +
    'z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;' +
    'font-family:Inter,system-ui,sans-serif;">' +
    '<div style="background:#0f1e36;border:1px solid #22304a;border-radius:16px;max-width:320px;' +
    'width:100%;padding:26px;color:#e7ecf5;text-align:center">' +
    '<h2 style="margin:0 0 14px;font-size:16px">🔒 ' + title + '</h2>' +
    '<input id="gasPinInput" type="password" inputmode="numeric" maxlength="8" placeholder="••••" ' +
    'style="width:100%;box-sizing:border-box;padding:12px;border-radius:8px;border:1px solid #2a3a57;' +
    'background:#0a1526;color:#fff;margin-bottom:12px;font-size:20px;text-align:center;letter-spacing:6px">' +
    '<div id="gasPinError" style="display:none;color:#ff7a7a;font-size:12px;margin-bottom:10px"></div>' +
    '<button id="gasPinSubmit" style="width:100%;padding:11px;border:0;border-radius:9px;' +
    'background:#2f6bf0;color:#fff;font-weight:700;font-size:14px;cursor:pointer">Onayla</button>' +
    '</div></div>'
  );
}

async function requirePinIfSet_(){
  const hash = localStorage.getItem('gas_pin_hash');
  if (!hash) return; // PIN kurulmamış, atla
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = pinLockModalHtml_('check');
    document.body.appendChild(wrap.firstChild);
    document.getElementById('gasPinInput').focus();
    document.getElementById('gasPinSubmit').addEventListener('click', async () => {
      const val = document.getElementById('gasPinInput').value;
      const h = await sha256Hex_(val);
      if (h === hash) {
        document.getElementById('gasPinOverlay').remove();
        resolve();
      } else {
        const eb = document.getElementById('gasPinError');
        eb.textContent = 'PIN hatalı.';
        eb.style.display = 'block';
      }
    });
  });
}

async function setPin_(){
  const val = prompt('Yeni PIN belirleyin (4-8 hane):');
  if (!val) return;
  const hash = await sha256Hex_(val);
  localStorage.setItem('gas_pin_hash', hash);
  alert('PIN kaydedildi. Bir sonraki açılışta istenecek.');
}

/* ============================================================
   BOOT: uygulama açılışında sırayla PIN -> ayar kontrolü -> refresh
============================================================ */
async function boot_(){
  await requirePinIfSet_();
  if (!gasConfigured_()) {
    openGasSetup_();
    return;
  }
  refresh();
}

// Service worker kaydı (yalnızca statik kabuğu önbelleğe alır, veriyi değil)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
