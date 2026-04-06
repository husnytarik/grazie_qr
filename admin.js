/* ═══════════════════════════════════════
   Coffee Grazie — Admin Panel Logic
   Firebase bağlantısı için:
   firebaseConfig değişkenini doldurun
═══════════════════════════════════════ */

// firebaseConfig → config.js dosyasından geliyor

// Firebase SDK (CDN üzerinden yüklendi)
let db,
  storage,
  isFirebaseReady = false;

// ── STATE ──
let categories = []; // { id, name, order }
let products = []; // { id, categoryId, name, price, desc, img, ings[], sizes[], milk[], extras[] }
let currentPage = "categories";
let drawerMode = null; // 'add-cat' | 'edit-cat' | 'add-product' | 'edit-product'
let editingId = null;
let photoFile = null;
let photoPreviewUrl = null;

// Tag state per field
const tagState = {
  ings: [],
  sizes: [],
  milk: [],
  extras: [],
};

// ── DEMO DATA (Firebase olmadan test için) ──
function loadDemoData() {
  categories = [
    { id: "demo-1", name: "Kahveler", order: 0 },
    { id: "demo-2", name: "Soğuk İçecekler", order: 1 },
    { id: "demo-3", name: "Tatlılar", order: 2 },
  ];
  products = [
    {
      id: "p-1",
      categoryId: "demo-1",
      name: "Cappuccino",
      price: "85",
      desc: "Espresso, buharlı süt ve köpük.",
      img: null,
      ings: ["Espresso", "Buharlı Süt", "Köpük"],
      sizes: ["Küçük", "Orta", "Büyük"],
      milk: ["Tam Yağlı", "Oat", "Badem"],
      extras: ["Ekstra Shot", "Karamel"],
    },
    {
      id: "p-2",
      categoryId: "demo-2",
      name: "Matcha Latte",
      price: "110",
      desc: "Seromoni matcha, oat milk, buz.",
      img: null,
      ings: ["Seromoni Matcha", "Oat Milk", "Buz"],
      sizes: ["Orta", "Büyük"],
      milk: ["Oat", "Badem"],
      extras: ["Şeker Şurubu"],
    },
  ];
  renderAll();
}

// ── FIREBASE CRUD ──
async function saveCategory(data) {
  if (!isFirebaseReady) {
    categories.push({ id: "local-" + Date.now(), ...data });
    return;
  }
  return await db.collection("categories").add(data);
}
async function updateCategory(id, data) {
  if (!isFirebaseReady) {
    const i = categories.findIndex((c) => c.id === id);
    if (i > -1) categories[i] = { ...categories[i], ...data };
    return;
  }
  return await db.collection("categories").doc(id).update(data);
}
async function deleteCategory(id) {
  if (!isFirebaseReady) {
    categories = categories.filter((c) => c.id !== id);
    return;
  }
  return await db.collection("categories").doc(id).delete();
}

async function saveProduct(data) {
  if (!isFirebaseReady) {
    products.push({ id: "local-" + Date.now(), ...data });
    return;
  }
  return await db.collection("products").add(data);
}
async function updateProduct(id, data) {
  if (!isFirebaseReady) {
    const i = products.findIndex((p) => p.id === id);
    if (i > -1) products[i] = { ...products[i], ...data };
    return;
  }
  return await db.collection("products").doc(id).update(data);
}
async function deleteProduct(id) {
  if (!isFirebaseReady) {
    products = products.filter((p) => p.id !== id);
    return;
  }
  return await db.collection("products").doc(id).delete();
}

async function uploadPhoto(file) {
  if (!isFirebaseReady) {
    // Demo: return base64
    return new Promise((res) => {
      const r = new FileReader();
      r.onload = (e) => res(e.target.result);
      r.readAsDataURL(file);
    });
  }
  const ref = storage.ref(`products/${Date.now()}_${file.name}`);
  await ref.put(file);
  return await ref.getDownloadURL();
}

function loadCategories() {
  if (!isFirebaseReady) return;
  db.collection("categories")
    .orderBy("order")
    .onSnapshot((snap) => {
      categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderAll();
    });
}
function loadProducts() {
  if (!isFirebaseReady) return;
  db.collection("products").onSnapshot((snap) => {
    products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  });
}

// ── RENDER ──
function renderAll() {
  renderCategories();
  renderProductTable();
  updateTopbar();
}

function renderCategories() {
  const grid = document.getElementById("catGrid");
  if (!grid) return;
  if (categories.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state-icon">☕</div>
      <div class="empty-state-text">Henüz kategori yok.<br>İlk kategoriyi ekle.</div>
    </div>`;
    return;
  }
  grid.innerHTML = categories
    .map((cat) => {
      const count = products.filter((p) => p.categoryId === cat.id).length;
      return `
      <div class="cat-card" onclick="selectCat('${cat.id}')">
        <div class="cat-card-name">${esc(cat.name)}</div>
        <div class="cat-card-count">${count} ürün</div>
        <div class="cat-card-actions">
          <button class="btn btn-outline btn-sm" onclick="openEditCat(event,'${cat.id}')">Düzenle</button>
          <button class="btn btn-danger btn-sm"  onclick="confirmDeleteCat(event,'${cat.id}')">Sil</button>
        </div>
      </div>
    `;
    })
    .join("");
}

let filterCatId = null;

function selectCat(id) {
  filterCatId = filterCatId === id ? null : id;
  renderProductTable();
  // Highlight selected cat card
  document
    .querySelectorAll(".cat-card")
    .forEach((c) => c.classList.remove("selected"));
  if (filterCatId) {
    const cards = document.querySelectorAll(".cat-card");
    // find by index
    const idx = categories.findIndex((c) => c.id === id);
    if (cards[idx]) cards[idx].classList.add("selected");
  }
  // Go to products page
  goToPage("products");
}

function renderProductTable() {
  const tbody = document.getElementById("productTbody");
  const filterLabel = document.getElementById("productsFilter");
  if (!tbody) return;

  let list = products;
  if (filterCatId) list = products.filter((p) => p.categoryId === filterCatId);

  if (filterLabel) {
    const cat = categories.find((c) => c.id === filterCatId);
    filterLabel.textContent = cat ? `→ ${cat.name}` : "Tümü";
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state">
        <div class="empty-state-icon">🍃</div>
        <div class="empty-state-text">Bu kategoride ürün yok.</div>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map((p) => {
      const cat = categories.find((c) => c.id === p.categoryId);
      const imgEl = p.img
        ? `<img class="product-thumb" src="${p.img}" alt="${esc(p.name)}">`
        : `<div class="product-thumb-ph"><svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>`;
      return `
      <tr>
        <td>${imgEl}</td>
        <td><div class="product-name-cell">${esc(p.name)}</div></td>
        <td><div class="product-price-cell">${esc(p.price)} ₺</div></td>
        <td><span class="tag">${cat ? esc(cat.name) : "—"}</span></td>
        <td><span class="tag">${p.ings ? p.ings.length : 0} içerik</span></td>
        <td>
          <div class="product-actions">
            <button class="btn btn-outline btn-sm" onclick="openEditProduct('${p.id}')">Düzenle</button>
            <button class="btn btn-danger btn-sm"  onclick="confirmDeleteProduct('${p.id}')">Sil</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

function updateTopbar() {
  const titles = { categories: "Kategoriler", products: "Ürünler" };
  document.getElementById("topbarTitle").textContent =
    titles[currentPage] || "";
}

// ── NAVIGATION ──
function goToPage(page) {
  closeSidebar();
  currentPage = page;
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  document.getElementById("page-" + page).classList.add("active");
  document.getElementById("nav-" + page).classList.add("active");
  updateTopbar();
}

// ── DRAWERS ──
function openDrawer(mode, id = null) {
  drawerMode = mode;
  editingId = id;
  photoFile = null;
  photoPreviewUrl = null;
  resetTags();

  const overlay = document.getElementById("drawerOverlay");
  const drawer = document.getElementById("drawer");
  const title = document.getElementById("drawerTitle");
  const body = document.getElementById("drawerBody");

  if (mode === "add-cat" || mode === "edit-cat") {
    title.textContent =
      mode === "add-cat" ? "Yeni Kategori" : "Kategoriyi Düzenle";
    const cat =
      mode === "edit-cat" ? categories.find((c) => c.id === id) : null;
    body.innerHTML = buildCatForm(cat);
  } else if (mode === "add-product" || mode === "edit-product") {
    title.textContent = mode === "add-product" ? "Yeni Ürün" : "Ürünü Düzenle";
    const p =
      mode === "edit-product" ? products.find((x) => x.id === id) : null;
    body.innerHTML = buildProductForm(p);
    if (p) populateTags(p);
    bindPhotoUpload();
    bindTagInputs();
  }

  overlay.classList.add("open");
  drawer.classList.add("open");
}

function closeDrawer() {
  document.getElementById("drawerOverlay").classList.remove("open");
  document.getElementById("drawer").classList.remove("open");
  drawerMode = null;
  editingId = null;
}

// ── CATEGORY FORM ──
function buildCatForm(cat) {
  return `
    <div class="form-group">
      <label class="form-label">Kategori Adı *</label>
      <input id="catName" class="form-input" type="text"
        placeholder="Kahveler, Soğuk İçecekler..." value="${cat ? esc(cat.name) : ""}">
    </div>
    <div class="form-group">
      <label class="form-label">Sıralama</label>
      <input id="catOrder" class="form-input" type="number"
        placeholder="0" value="${cat ? cat.order || 0 : categories.length}">
    </div>
  `;
}

async function saveDrawer() {
  if (drawerMode === "add-cat" || drawerMode === "edit-cat") {
    const name = document.getElementById("catName").value.trim();
    const order = parseInt(document.getElementById("catOrder").value) || 0;
    if (!name) {
      showToast("Kategori adı gerekli", "error");
      return;
    }
    setDrawerLoading(true);
    try {
      if (drawerMode === "add-cat") {
        await saveCategory({ name, order });
        showToast("Kategori eklendi ✓", "success");
      } else {
        await updateCategory(editingId, { name, order });
        showToast("Kategori güncellendi ✓", "success");
      }
      if (!isFirebaseReady) renderAll();
      closeDrawer();
    } catch (e) {
      showToast("Hata: " + e.message, "error");
    }
    setDrawerLoading(false);
  } else if (drawerMode === "add-product" || drawerMode === "edit-product") {
    const name = document.getElementById("pName").value.trim();
    const price = document.getElementById("pPrice").value.trim();
    const desc = document.getElementById("pDesc").value.trim();
    const catId = document.getElementById("pCat").value;

    if (!name || !price || !catId) {
      showToast("Ad, fiyat ve kategori zorunlu", "error");
      return;
    }

    setDrawerLoading(true);
    try {
      let imgUrl = null;
      if (drawerMode === "edit-product") {
        const existing = products.find((p) => p.id === editingId);
        imgUrl = existing?.img || null;
      }
      if (photoFile) imgUrl = await uploadPhoto(photoFile);

      const data = {
        name,
        price,
        desc,
        categoryId: catId,
        img: imgUrl,
        ings: [...tagState.ings],
        sizes: [...tagState.sizes],
        milk: [...tagState.milk],
        extras: [...tagState.extras],
        updatedAt: new Date().toISOString(),
      };

      if (drawerMode === "add-product") {
        data.createdAt = new Date().toISOString();
        await saveProduct(data);
        showToast("Ürün eklendi ✓", "success");
      } else {
        await updateProduct(editingId, data);
        showToast("Ürün güncellendi ✓", "success");
      }
      if (!isFirebaseReady) renderAll();
      closeDrawer();
    } catch (e) {
      showToast("Hata: " + e.message, "error");
    }
    setDrawerLoading(false);
  }
}

// ── PRODUCT FORM ──
function buildProductForm(p) {
  const catOptions = categories
    .map(
      (c) =>
        `<option value="${c.id}" ${p && p.categoryId === c.id ? "selected" : ""}>
      ${esc(c.name)}
    </option>`,
    )
    .join("");

  const photoSection = p?.img
    ? `<div class="photo-preview-wrap">
        <img class="photo-preview" id="photoPreviewImg" src="${p.img}" alt="">
        <button class="photo-preview-remove" onclick="removePhoto()">Kaldır</button>
       </div>`
    : `<div class="photo-upload-area" id="photoUploadArea">
        <input type="file" id="photoFileInput" accept="image/*">
        <div class="photo-upload-icon">📷</div>
        <div class="photo-upload-text">Fotoğraf seç veya sürükle bırak</div>
        <div class="photo-upload-sub">JPG, PNG, WEBP — max 5MB</div>
       </div>`;

  return `
    <div class="form-group">
      <label class="form-label">Fotoğraf</label>
      <div id="photoSection">${photoSection}</div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Ürün Adı *</label>
        <input id="pName" class="form-input" type="text"
          placeholder="Cappuccino" value="${p ? esc(p.name) : ""}">
      </div>
      <div class="form-group">
        <label class="form-label">Fiyat (₺) *</label>
        <input id="pPrice" class="form-input" type="text"
          placeholder="85" value="${p ? esc(p.price) : ""}">
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Kategori *</label>
      <select id="pCat" class="form-select">
        <option value="">— Seç —</option>
        ${catOptions}
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Açıklama</label>
      <textarea id="pDesc" class="form-textarea"
        placeholder="Ürün hakkında kısa bir açıklama...">${p ? esc(p.desc || "") : ""}</textarea>
    </div>

    <div class="form-group">
      <label class="form-label">İçindekiler</label>
      <div class="tag-input-wrap" id="wrap-ings">
        <input class="tag-input-field" id="input-ings" placeholder="Ekle → Enter">
      </div>
      <div class="tag-hint">Her malzemeyi girdikten sonra Enter'a bas</div>
    </div>

    <div class="form-group">
      <label class="form-label">Boyut Seçenekleri</label>
      <div class="tag-input-wrap" id="wrap-sizes">
        <input class="tag-input-field" id="input-sizes" placeholder="Küçük, Orta, Büyük...">
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Süt Seçenekleri</label>
      <div class="tag-input-wrap" id="wrap-milk">
        <input class="tag-input-field" id="input-milk" placeholder="Tam Yağlı, Oat, Badem...">
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Ekstralar</label>
      <div class="tag-input-wrap" id="wrap-extras">
        <input class="tag-input-field" id="input-extras" placeholder="Ekstra Shot, Karamel...">
      </div>
    </div>
  `;
}

function populateTags(p) {
  ["ings", "sizes", "milk", "extras"].forEach((key) => {
    tagState[key] = [...(p[key] || [])];
    renderTags(key);
  });
}

function resetTags() {
  ["ings", "sizes", "milk", "extras"].forEach((k) => {
    tagState[k] = [];
  });
}

// ── TAG INPUT ──
function bindTagInputs() {
  ["ings", "sizes", "milk", "extras"].forEach((key) => {
    const input = document.getElementById("input-" + key);
    if (!input) return;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const val = input.value.trim().replace(/,$/, "");
        if (val && !tagState[key].includes(val)) {
          tagState[key].push(val);
          renderTags(key);
        }
        input.value = "";
      } else if (
        e.key === "Backspace" &&
        !input.value &&
        tagState[key].length
      ) {
        tagState[key].pop();
        renderTags(key);
      }
    });
    // click on wrap = focus input
    document
      .getElementById("wrap-" + key)
      .addEventListener("click", () => input.focus());
  });
}

function renderTags(key) {
  const wrap = document.getElementById("wrap-" + key);
  const input = document.getElementById("input-" + key);
  if (!wrap || !input) return;
  // Remove existing pills
  wrap.querySelectorAll(".tag-pill").forEach((el) => el.remove());
  // Re-insert pills before input
  tagState[key].forEach((val, i) => {
    const pill = document.createElement("span");
    pill.className = "tag-pill";
    pill.innerHTML = `${esc(val)}<button class="tag-pill-remove" onclick="removeTag('${key}',${i})">×</button>`;
    wrap.insertBefore(pill, input);
  });
}

function removeTag(key, i) {
  tagState[key].splice(i, 1);
  renderTags(key);
}

// ── PHOTO UPLOAD ──
function bindPhotoUpload() {
  const input = document.getElementById("photoFileInput");
  if (!input) return;
  input.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Max 5MB", "error");
      return;
    }
    photoFile = file;
    const url = URL.createObjectURL(file);
    photoPreviewUrl = url;
    document.getElementById("photoSection").innerHTML = `
      <div class="photo-preview-wrap">
        <img class="photo-preview" id="photoPreviewImg" src="${url}" alt="">
        <button class="photo-preview-remove" onclick="removePhoto()">Kaldır</button>
      </div>`;
  });

  const area = document.getElementById("photoUploadArea");
  if (!area) return;
  area.addEventListener("dragover", (e) => {
    e.preventDefault();
    area.classList.add("dragover");
  });
  area.addEventListener("dragleave", () => area.classList.remove("dragover"));
  area.addEventListener("drop", (e) => {
    e.preventDefault();
    area.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) {
      input.files = e.dataTransfer.files;
      input.dispatchEvent(new Event("change"));
    }
  });
}

function removePhoto() {
  photoFile = null;
  photoPreviewUrl = null;
  document.getElementById("photoSection").innerHTML = `
    <div class="photo-upload-area" id="photoUploadArea">
      <input type="file" id="photoFileInput" accept="image/*">
      <div class="photo-upload-icon">📷</div>
      <div class="photo-upload-text">Fotoğraf seç veya sürükle bırak</div>
      <div class="photo-upload-sub">JPG, PNG, WEBP — max 5MB</div>
    </div>`;
  bindPhotoUpload();
}

// ── DELETE CONFIRMS ──
function confirmDeleteCat(e, id) {
  e.stopPropagation();
  const cat = categories.find((c) => c.id === id);
  const count = products.filter((p) => p.categoryId === id).length;
  const msg =
    count > 0
      ? `"${cat?.name}" kategorisini sil? İçindeki ${count} ürün de silinecek.`
      : `"${cat?.name}" kategorisini sil?`;
  if (!confirm(msg)) return;
  deleteCategory(id).then(() => {
    // also delete products in this category
    products
      .filter((p) => p.categoryId === id)
      .forEach((p) => deleteProduct(p.id));
    if (!isFirebaseReady) {
      products = products.filter((p) => p.categoryId !== id);
      renderAll();
    }
    showToast("Kategori silindi", "success");
  });
}

function confirmDeleteProduct(id) {
  const p = products.find((x) => x.id === id);
  if (!confirm(`"${p?.name}" ürününü sil?`)) return;
  deleteProduct(id).then(() => {
    if (!isFirebaseReady) renderAll();
    showToast("Ürün silindi", "success");
  });
}

function openEditCat(e, id) {
  e.stopPropagation();
  openDrawer("edit-cat", id);
}
function openEditProduct(id) {
  openDrawer("edit-product", id);
}

// ── LOADING STATE ──
function setDrawerLoading(on) {
  const btn = document.getElementById("saveBtn");
  if (btn) {
    btn.disabled = on;
    btn.textContent = on ? "Kaydediliyor…" : "Kaydet";
  }
}

// ── TOAST ──
function showToast(msg, type = "") {
  const wrap = document.getElementById("toastWrap");
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── CONFIG BANNER ──
function showBanner() {
  const b = document.getElementById("configBanner");
  if (b) b.style.display = "flex";
}
function hideBanner() {
  const b = document.getElementById("configBanner");
  if (b) b.style.display = "none";
}

// ── UTILS ──
function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── INIT ──
let auth;

document.addEventListener("DOMContentLoaded", () => {
  // Firebase tek seferinde başlat
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  storage = firebase.storage();
  auth = firebase.auth();
  isFirebaseReady = true;

  goToPage("categories");

  // Auth durumu belli olunca yükle
  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    // Giriş yapılmış — verileri yükle
    hideBanner();
    loadCategories();
    loadProducts();
  });
});

function handleLogout() {
  if (auth)
    auth.signOut().then(() => {
      window.location.href = "login.html";
    });
}

// ── SIDEBAR MOBILE ──
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (sidebar.classList.contains("open")) {
    closeSidebar();
  } else {
    sidebar.classList.add("open");
    backdrop.classList.add("show");
    document.body.style.overflow = "hidden";
  }
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarBackdrop").classList.remove("show");
  document.body.style.overflow = "";
}
