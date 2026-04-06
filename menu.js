/* ═══════════════════════════════════════
   Coffee Grazie — Menu (Firebase)
═══════════════════════════════════════ */

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ── STATE ──
let categories = [];
let products = [];

// ── INIT ──
document.addEventListener("DOMContentLoaded", () => {
  loadMenu();
});

async function loadMenu() {
  try {
    // Kategorileri ve ürünleri paralel çek
    const [catSnap, prodSnap] = await Promise.all([
      db.collection("categories").orderBy("order").get(),
      db.collection("products").get(),
    ]);

    categories = catSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    products = prodSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Loading'i kaldır
    document.getElementById("menuLoading").style.display = "none";

    buildMenu();
  } catch (e) {
    console.error("Firebase yükleme hatası:", e);
    document.getElementById("menuLoading").innerHTML =
      '<div style="color:var(--muted);font-size:13px;text-align:center;padding:40px">Menü yüklenemedi.</div>';
  }
}

// ── BUILD MENU ──
function buildMenu() {
  const tabsEl = document.getElementById("tabs");
  const mainEl = document.getElementById("main");
  tabsEl.innerHTML = "";
  mainEl.innerHTML = "";

  if (categories.length === 0) {
    mainEl.innerHTML =
      '<div style="padding:60px 24px;text-align:center;color:var(--muted);font-size:13px;">Henüz menü eklenmemiş.</div>';
    return;
  }

  categories.forEach((cat, ci) => {
    // Tab
    const tab = document.createElement("button");
    tab.className = "tab" + (ci === 0 ? " active" : "");
    tab.textContent = cat.name;
    tab.onclick = () => switchCat(ci);
    tabsEl.appendChild(tab);

    // Section
    const sec = document.createElement("div");
    sec.className = "cat-section" + (ci === 0 ? " active" : "");

    const tEl = document.createElement("div");
    tEl.className = "cat-title";
    tEl.textContent = cat.name;
    sec.appendChild(tEl);

    const list = document.createElement("div");
    list.className = "product-list";

    // Bu kategoriye ait ürünler
    const catProducts = products.filter((p) => p.categoryId === cat.id);

    if (catProducts.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText =
        "padding:30px 24px;color:var(--muted);font-size:12px;font-weight:300;";
      empty.textContent = "Bu kategoride henüz ürün yok.";
      list.appendChild(empty);
    }

    catProducts.forEach((item) => {
      const row = document.createElement("div");
      row.className = "p-row";
      row.onclick = () => openOverlay(item);

      // Thumbnail
      const iw = document.createElement("div");
      iw.className = "p-img-wrap";
      if (item.img) {
        const img = document.createElement("img");
        img.src = item.img;
        img.alt = item.name;
        img.loading = "lazy";
        iw.appendChild(img);
      } else {
        const ph = document.createElement("div");
        ph.className = "p-img-ph";
        ph.innerHTML = `<svg viewBox="0 0 24 24"><path d="M2 21h18v-2H2v2zm6-4h8a4 4 0 000-8h-.17A5 5 0 004 11v2a4 4 0 004 4zm8-6a2 2 0 010 4H8a2 2 0 01-2-2v-1.18A3 3 0 0113.85 11H16z"/></svg>`;
        iw.appendChild(ph);
      }

      // Text
      const txt = document.createElement("div");
      txt.className = "p-text";
      txt.innerHTML = `
        <div class="p-name">${esc(item.name)}</div>
        <div class="p-price">${esc(item.price)} ₺</div>
        <div class="p-desc">${esc(item.desc || "")}</div>
      `;

      row.appendChild(iw);
      row.appendChild(txt);
      list.appendChild(row);
    });

    sec.appendChild(list);
    mainEl.appendChild(sec);
  });
}

// ── OVERLAY ──
function openOverlay(item) {
  document.getElementById("ovName").textContent = item.name;
  document.getElementById("ovPrice").textContent = (item.price || "") + " ₺";
  document.getElementById("ovDesc").textContent = item.desc || "";

  // İçindekiler
  const ingsEl = document.getElementById("ovIngs");
  ingsEl.innerHTML = '<div class="ov-ings-label">İçindekiler</div>';
  const ings = item.ings || [];
  if (ings.length === 0) {
    const none = document.createElement("div");
    none.className = "ing-item";
    none.innerHTML = `<span class="ing-name" style="opacity:0.4">—</span>`;
    ingsEl.appendChild(none);
  } else {
    ings.forEach((ing, i) => {
      const div = document.createElement("div");
      div.className = "ing-item";
      div.style.animationDelay = i * 0.07 + 0.18 + "s";
      div.innerHTML = `<span class="ing-dot"></span><span class="ing-name">${esc(ing)}</span>`;
      ingsEl.appendChild(div);
    });
  }

  // Görsel
  const imgWrap = document.getElementById("ovImgWrap");
  imgWrap.innerHTML = "";
  if (item.img) {
    const img = document.createElement("img");
    img.src = item.img;
    img.alt = item.name;
    imgWrap.appendChild(img);
    requestAnimationFrame(() => img.classList.add("img-enter"));
  } else {
    const ph = document.createElement("div");
    ph.className = "ov-ph";
    ph.innerHTML = `<svg viewBox="0 0 24 24"><path d="M2 21h18v-2H2v2zm6-4h8a4 4 0 000-8h-.17A5 5 0 004 11v2a4 4 0 004 4zm8-6a2 2 0 010 4H8a2 2 0 01-2-2v-1.18A3 3 0 0113.85 11H16z"/></svg>`;
    imgWrap.appendChild(ph);
    requestAnimationFrame(() => ph.classList.add("img-enter"));
  }

  // Seçenekler
  buildChips("sizeChips", "sizeBlock", item.sizes || []);
  buildChips("milkChips", "milkBlock", item.milk || []);
  buildChips("extraChips", "extrasBlock", item.extras || []);

  const overlay = document.getElementById("overlay");
  overlay.classList.remove("closing");
  overlay.classList.add("open");
  overlay.scrollTop = 0;
  document.body.classList.add("locked");
}

function closeOverlay() {
  const overlay = document.getElementById("overlay");
  overlay.classList.add("closing");
  document.body.classList.remove("locked");
  setTimeout(() => overlay.classList.remove("open", "closing"), 370);
}

function buildChips(cid, bid, opts) {
  const block = document.getElementById(bid);
  const wrap = document.getElementById(cid);
  wrap.innerHTML = "";
  if (!opts || !opts.length) {
    block.style.display = "none";
    return;
  }
  block.style.display = "block";
  opts.forEach((opt) => {
    const c = document.createElement("span");
    c.className = "chip";
    c.textContent = opt;
    wrap.appendChild(c);
  });
}

function switchCat(ci) {
  document
    .querySelectorAll(".tab")
    .forEach((t, i) => t.classList.toggle("active", i === ci));
  document
    .querySelectorAll(".cat-section")
    .forEach((s, i) => s.classList.toggle("active", i === ci));
}

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
