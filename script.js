// ---------- KONFIGURASI API BACKEND ----------
const API_BASE_URL = 'https://backendrecepi.onrender.com/api';
let apiRecipes = [];

const placeholderImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23d8b48c'/%3E%3Ctext x='50' y='55' font-size='14' text-anchor='middle' fill='%235c3e2b'%3E🍽️%3C/text%3E%3C/svg%3E";
const categoriesList = ["Daging", "Ayam", "Ikan/Seafood", "Sayur", "Nasi", "Jajanan"];

// ---------- STORAGE LOKAL (Sesi, Favorit) ----------
let currentUser = null;
let favorites = new Set();
let apiComments = {};

function loadAllData() {
  const storedSession = localStorage.getItem("nusantara_session");
  if(storedSession) {
    currentUser = JSON.parse(storedSession);
  }
  if(currentUser) {
    const favKey = `fav_${currentUser.email}`;
    const storedFav = localStorage.getItem(favKey);
    favorites = storedFav ? new Set(JSON.parse(storedFav)) : new Set();
  } else favorites = new Set();
}
function saveSession() {
  if(currentUser) localStorage.setItem("nusantara_session", JSON.stringify(currentUser));
  else localStorage.removeItem("nusantara_session");
}
function saveFavorites() { if(currentUser) localStorage.setItem(`fav_${currentUser.email}`, JSON.stringify([...favorites])); }

async function fetchCommentsFromAPI(recipeId) {
  const rid = recipeId.toString();
  try {
    const response = await fetch(`${API_BASE_URL}/comments?recipeId=${recipeId}`);
    if (!response.ok) {
      const message = `Gagal memuat komentar (status ${response.status})`;
      console.error(message);
      showToast(message, 'error');
      apiComments[rid] = apiComments[rid] || [];
      return apiComments[rid];
    }

    apiComments[rid] = await response.json();
    return apiComments[rid];
  } catch (error) {
    console.error("Gagal mengambil komentar:", error);
    showToast('Tidak bisa memuat komentar. Coba lagi.', 'error');
    apiComments[rid] = apiComments[rid] || [];
    return apiComments[rid];
  }
}

function getRecipeRating(recipeId) {
  const comments = getComments(recipeId);
  if (!comments.length) return 0;
  const sum = comments.reduce((a, c) => a + c.rating, 0);
  return sum / comments.length;
}

function getComments(recipeId) { return apiComments[recipeId.toString()] || []; }

function getUserRating(recipeId) {
  if (!currentUser) return null;
  const comments = getComments(recipeId);
  const userComment = comments.find(c => c.userId === currentUser.email);
  return userComment ? userComment.rating : null;
}

function getUserCommentText(recipeId) {
  if (!currentUser) return "";
  const comments = getComments(recipeId);
  const userComment = comments.find(c => c.userId === currentUser.email);
  return userComment ? userComment.text : "";
}

async function submitComment(recipeId, userName, commentText, ratingValue) {
  if (!currentUser) throw new Error('User belum login');
  const payload = {
    recipeId,
    accountId: currentUser.id,
    text: commentText.trim() || "(Tanpa komentar)",
    rating: ratingValue
  };
  const response = await fetch(`${API_BASE_URL}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Gagal menyimpan komentar');
  }
  await fetchCommentsFromAPI(recipeId);
}

async function deleteCommentFromAPI(commentId, recipeId) {
  if (!currentUser) throw new Error('User belum login');
  const response = await fetch(`${API_BASE_URL}/comments/${commentId}?requesterId=${currentUser.id}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Gagal menghapus komentar');
  }
  await fetchCommentsFromAPI(recipeId);
}

// ---------- API RECIPES ----------
async function fetchRecipesFromAPI() {
  try {
    const response = await fetch(`${API_BASE_URL}/recipes`);
    if (response.ok) {
      apiRecipes = await response.json();
      renderCurrentView();
    }
  } catch (error) {
    console.error("Gagal mengambil resep:", error);
  }
}
function getAllRecipes() { return apiRecipes; }
function getUserUploadedRecipes() {
  return currentUser ? apiRecipes.filter(r => r.author && r.author.email === currentUser.email) : [];
}

// ---------- KONFIRMASI & TOAST ----------
function showConfirm(message, onYes, onNo) {
  const modal = document.getElementById('confirmModal');
  document.getElementById('confirmMessage').innerText = message;
  modal.style.display = 'flex';
  const yesBtn = document.getElementById('confirmYesBtn');
  const noBtn = document.getElementById('confirmNoBtn');
  const handleYes = () => { modal.style.display = 'none'; if(onYes) onYes(); cleanup(); };
  const handleNo = () => { modal.style.display = 'none'; if(onNo) onNo(); cleanup(); };
  const cleanup = () => { yesBtn.removeEventListener('click', handleYes); noBtn.removeEventListener('click', handleNo); };
  yesBtn.addEventListener('click', handleYes);
  noBtn.addEventListener('click', handleNo);
  modal.onclick = (e) => { if(e.target === modal) handleNo(); };
}
function deleteCommentWithConfirm(recipeId, commentId, element) {
  showConfirm('Hapus komentar ini?', async () => {
    try {
      await deleteCommentFromAPI(commentId, recipeId);
      showToast('Komentar dihapus', 'success');
      if(currentModalRecipe && currentModalRecipe.id == recipeId) await openModal(currentModalRecipe);
      else renderCurrentView();
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Gagal menghapus komentar', 'error');
    }
  });
}
function logoutWithConfirm() {
  showConfirm('Anda yakin ingin logout?', () => {
    currentUser = null;
    favorites.clear();
    saveSession();
    updateUIAfterAuth();
    renderCurrentView();
    showToast('Anda telah logout', 'success');
  });
}
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.innerText = message;
  toast.style.position = 'fixed'; toast.style.bottom = '20px'; toast.style.left = '50%'; toast.style.transform = 'translateX(-50%)';
  toast.style.backgroundColor = type === 'success' ? '#2e5a2b' : '#a94442';
  toast.style.color = 'white'; toast.style.padding = '10px 20px'; toast.style.borderRadius = '40px';
  toast.style.fontSize = '0.9rem'; toast.style.zIndex = '9999'; toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'; toast.style.fontWeight = '500';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// ---------- FAVORIT ----------
function isFavorite(id) { return favorites.has(id.toString()); }
function toggleFavorite(id) {
  if(!currentUser) { showToast('Login dulu untuk favorit', 'error'); return false; }
  const idStr = id.toString();
  if(favorites.has(idStr)) favorites.delete(idStr);
  else favorites.add(idStr);
  saveFavorites();
  renderCurrentView();
  return true;
}

// ---------- TAMBAH RESEP ----------
async function addNewRecipe(recipeData, imageBase64) {
  if(!currentUser) { showToast('Login untuk menambah resep', 'error'); return false; }
  const newRecipePayload = {
    name: recipeData.name,
    region: recipeData.region,
    description: recipeData.description,
    category: recipeData.category,
    difficulty: recipeData.difficulty,
    timeToCook: recipeData.time,
    imageUrl: imageBase64,
    ingredients: recipeData.ingredients,
    steps: recipeData.steps
  };
  try {
    const response = await fetch(`${API_BASE_URL}/recipes?userId=${currentUser.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRecipePayload)
    });
    if(response.ok) {
      showToast('Resep berhasil ditambahkan!', 'success');
      fetchRecipesFromAPI();
      return true;
    } else {
      showToast('Gagal menambahkan resep', 'error');
      return false;
    }
  } catch (error) {
    console.error(error);
    return false;
  }
}

function deleteRecipeWithConfirm(recipeId) {
  showConfirm('Hapus resep ini secara permanen?', async () => {
    if(currentUser) {
      try {
        const response = await fetch(`${API_BASE_URL}/recipes/${recipeId}?requesterId=${currentUser.id}`, { method: 'DELETE' });
        if(response.ok) {
          showToast('Resep dihapus', 'success');
          fetchRecipesFromAPI();
        } else {
          showToast('Tidak punya izin', 'error');
        }
      } catch(e) { console.error(e); }
    }
  });
}

// ---------- RENDER STARS ----------
function renderStars(rating, showNumber=true) {
  let html = '';
  for(let i=1;i<=5;i++) html += (i <= Math.floor(rating)) ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
  if(showNumber && rating) html += ` <span style="font-size:0.8rem;">(${rating.toFixed(1)}/5)</span>`;
  return html;
}

function renderRecipes(recipesArray, showDeleteForOwner = true) {
  if(!recipesArray.length) return `<div class="not-found">Tidak ada resep.</div>`;
  return recipesArray.map(recipe => {
    const avgRating = getRecipeRating(recipe.id);
    const favActive = isFavorite(recipe.id) ? 'active-star' : '';
    const starIcon = isFavorite(recipe.id) ? 'fas fa-star' : 'far fa-star';
    let deleteBtn = '';
    const isOwner = currentUser && recipe.author && recipe.author.email === currentUser.email;
    const isAdmin = currentUser && currentUser.role_type === 'ADMIN';
    if(showDeleteForOwner && (isOwner || isAdmin)) {
      deleteBtn = `<button class="btn-delete delete-recipe-btn" data-id="${recipe.id}"><i class="fas fa-trash"></i> Hapus Resep</button>`;
    }
    const imgSource = recipe.imageUrl || placeholderImage;
    const timeCook = recipe.timeToCook || '30 menit';
    return `
      <div class="recipe-card" data-id="${recipe.id}">
        <div class="favorite-star ${favActive}" data-id="${recipe.id}"><i class="${starIcon}"></i></div>
        <img class="card-img" src="${imgSource}" alt="${recipe.name}" onerror="this.src='${placeholderImage}'">
        <div class="card-content">
          <div class="recipe-title">${recipe.name}<span class="rating-stars">${renderStars(avgRating, true)}</span></div>
          <div class="meta-info"><span>📍 ${recipe.region}</span> • 🕒 ${timeCook} • 🏷️ ${recipe.category}</div>
          <div class="recipe-desc">${recipe.description.substring(0, 80)}...</div>
          <div style="font-size: 0.75rem; color: #8b5a3c; margin-top: 5px;">Ditambahkan oleh: ${recipe.author ? recipe.author.username : 'Admin/Sistem'}</div>
          <button class="btn-detail view-detail" data-id="${recipe.id}">Lihat & Komentar</button>
          ${deleteBtn}
        </div>
      </div>
    `;
  }).join('');
}

// ---------- TAMPILAN HALAMAN ----------
let activeCategory = "Daging";
let currentView = "home";

// ========== SLIDER ==========
let sliderInterval = null;

function stopSliderInterval() {
  if (sliderInterval) {
    clearInterval(sliderInterval);
    sliderInterval = null;
  }
}

function startSliderInterval(sliderElement, nextButton) {
  if (sliderInterval) stopSliderInterval();
  sliderInterval = setInterval(() => {
    if (nextButton) nextButton.click();
  }, 5000);
}

function generateSliderHTML() {
    // Data 4 makanan nusantara (Bakso telah dihapus)
    const foodSlides = [
      {
        name: "Rendang",
        region: "Padang",
        imageUrl: "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=800&h=500&fit=crop",
      },
      {
        name: "Sate Ayam",
        region: "Madura",
        imageUrl: "https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=800&h=500&fit=crop",
      },
      {
        name: "Nasi Goreng",
        region: "Indonesia",
        imageUrl: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&h=500&fit=crop",
      },
      {
        name: "Gado-Gado",
        region: "Betawi",
        imageUrl: "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=800&h=500&fit=crop",
      }
    ];
  
    let slidesHTML = '';
    for (let food of foodSlides) {
      slidesHTML += `
        <div class="slide">
          <img src="${food.imageUrl}" alt="${food.name}" style="width:100%; height:100%; object-fit:cover;">
          <div class="slide-caption">${food.name} - ${food.region}</div>
        </div>
      `;
    }
  
    return `
      <div class="slider-container">
        <div class="slider" id="dynamicSlider">
          ${slidesHTML}
        </div>
        <button class="prev" id="sliderPrev">❮</button>
        <button class="next" id="sliderNext">❯</button>
        <div class="dots" id="sliderDots"></div>
      </div>
    `;
  }

function initSlider() {
  const slider = document.getElementById('dynamicSlider');
  if (!slider) return;
  
  const slides = slider.querySelectorAll('.slide');
  if (slides.length === 0) return;
  
  let currentIndex = 0;
  const totalSlides = slides.length;
  const prevBtn = document.getElementById('sliderPrev');
  const nextBtn = document.getElementById('sliderNext');
  const dotsContainer = document.getElementById('sliderDots');
  
  dotsContainer.innerHTML = '';
  for (let i = 0; i < totalSlides; i++) {
    const dot = document.createElement('span');
    dot.classList.add('dot');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goToSlide(i));
    dotsContainer.appendChild(dot);
  }
  const dots = document.querySelectorAll('.dot');
  
  function updateSlider() {
    slider.style.transform = `translateX(-${currentIndex * 100}%)`;
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentIndex);
    });
  }
  
  function goToSlide(index) {
    if (index < 0) index = totalSlides - 1;
    if (index >= totalSlides) index = 0;
    currentIndex = index;
    updateSlider();
    stopSliderInterval();
    startSliderInterval(slider, nextBtn);
  }
  
  function nextSlide() { goToSlide(currentIndex + 1); }
  function prevSlide() { goToSlide(currentIndex - 1); }
  
  if (prevBtn) prevBtn.addEventListener('click', prevSlide);
  if (nextBtn) nextBtn.addEventListener('click', nextSlide);
  
  startSliderInterval(slider, nextBtn);
  
  const container = document.querySelector('.slider-container');
  if (container) {
    container.addEventListener('mouseenter', () => stopSliderInterval());
    container.addEventListener('mouseleave', () => startSliderInterval(slider, nextBtn));
  }
}

// ========== FUNGSI HISTORY KOMENTAR LENGKAP DENGAN TANGGAL RESEP ==========
async function getAllCommentsWithRecipeDetails() {
  let allData = [];
  for (let recipe of getAllRecipes()) {
    await fetchCommentsFromAPI(recipe.id);
    const comments = getComments(recipe.id);
    const recipeCreatedDate = recipe.createdAt ? new Date(recipe.createdAt).toLocaleString('id-ID') : 'Tidak diketahui';
    for (let comment of comments) {
      allData.push({
        recipeName: recipe.name,
        recipeCreatedDate: recipeCreatedDate,
        comment: comment,
        commentDate: comment.date
      });
    }
  }
  allData.sort((a, b) => new Date(b.commentDate) - new Date(a.commentDate));
  return allData;
}

function openFullCommentHistoryModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.style.alignItems = 'flex-start';
  modal.style.paddingTop = '2rem';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 900px; max-height: 85vh; overflow-y: auto;">
      <button class="close-modal" id="closeHistoryModal">&times;</button>
      <h2>📜 Seluruh History Komentar</h2>
      <p style="margin-bottom: 1rem; color: #5e4533;">Menampilkan semua komentar dari seluruh resep, lengkap dengan tanggal komentar dan tanggal resep dibuat.</p>
      <div id="fullHistoryList" style="margin-top: 1rem;">Memuat data...</div>
    </div>
  `;
  document.body.appendChild(modal);
  
  const closeBtn = modal.querySelector('#closeHistoryModal');
  closeBtn.onclick = () => modal.remove();
  modal.onclick = (e) => { if(e.target === modal) modal.remove(); };
  
  getAllCommentsWithRecipeDetails().then(data => {
    const container = modal.querySelector('#fullHistoryList');
    if (data.length === 0) {
      container.innerHTML = '<p>Belum ada komentar dari user manapun.</p>';
      return;
    }
    let html = '';
    for (let item of data) {
      const ratingStars = renderStars(item.comment.rating, false);
      html += `
        <div class="comment-item" style="margin-bottom: 1.2rem; border-left: 4px solid var(--green-soft);">
          <div><strong>${escapeHtml(item.comment.userName)}</strong> ${ratingStars}</div>
          <div style="font-size: 0.8rem; color: #7b5a41;">
            📌 Resep: <strong>${escapeHtml(item.recipeName)}</strong> 
            (dibuat: ${item.recipeCreatedDate})
          </div>
          <div style="font-size: 0.75rem; color: #8b5a3c;">🕒 Komentar dikirim: ${item.comment.date}</div>
          <p style="margin-top: 8px;">${escapeHtml(item.comment.text)}</p>
        </div>
      `;
    }
    container.innerHTML = html;
  }).catch(err => {
    modal.querySelector('#fullHistoryList').innerHTML = '<p class="warning">Gagal memuat data komentar.</p>';
    console.error(err);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// ========== RENDER HOME ==========
function renderHome() {
  const popular = getAllRecipes().slice(0,6);
  const sliderHTML = generateSliderHTML();
  return `
    ${sliderHTML}
    <div class="page-header"><h2>Semua Resep Nusantara</h2></div>
    <div class="recipes-grid">${renderRecipes(popular, true)}</div>
  `;
}

function renderKategori() {
  const filtered = getAllRecipes().filter(r => r.category === activeCategory);
  let chips = `<div class="category-filters">`;
  categoriesList.forEach(cat => { chips += `<button class="cat-chip ${activeCategory===cat?'active-cat':''}" data-cat="${cat}">${cat}</button>`; });
  chips += `</div><div class="recipes-grid">${renderRecipes(filtered, true)}</div>`;
  return chips;
}
function renderFavorite() {
  if(!currentUser) return `<div class="not-found">Login untuk melihat favorit.</div>`;
  const all = getAllRecipes();
  return `<div class="page-header"><h2>Resep Favorit</h2></div><div class="recipes-grid">${renderRecipes(all.filter(r => isFavorite(r.id)), true)}</div>`;
}

// ========== FUNGSI UNTUK RENUMBER BAHAN DAN LANGKAH ==========
function renumberIngredients() {
  const containers = document.querySelectorAll('#ingredientsContainer .dynamic-ingredient');
  containers.forEach((container, idx) => {
    const input = container.querySelector('input[name="ingredient"]');
    if (input) input.placeholder = `Bahan ${idx + 1}`;
  });
}
function renumberSteps() {
  const containers = document.querySelectorAll('#stepsContainer .dynamic-step');
  containers.forEach((container, idx) => {
    const input = container.querySelector('input[name="step"]');
    if (input) input.placeholder = `Langkah ${idx + 1}`;
  });
}
function initDynamicForm() {
  document.querySelectorAll('#ingredientsContainer .remove-ingredient-btn').forEach(btn => {
    btn.removeEventListener('click', btn._listener);
    const newListener = function() { this.closest('.dynamic-ingredient').remove(); renumberIngredients(); };
    btn.addEventListener('click', newListener);
    btn._listener = newListener;
  });
  document.querySelectorAll('#stepsContainer .remove-step-btn').forEach(btn => {
    btn.removeEventListener('click', btn._listener);
    const newListener = function() { this.closest('.dynamic-step').remove(); renumberSteps(); };
    btn.addEventListener('click', newListener);
    btn._listener = newListener;
  });
  renumberIngredients(); renumberSteps();
}
function addIngredientField() {
  const container = document.getElementById('ingredientsContainer');
  const newDiv = document.createElement('div');
  newDiv.className = 'dynamic-ingredient';
  newDiv.style.display = 'flex'; newDiv.style.gap = '8px'; newDiv.style.marginBottom = '8px';
  const currentCount = container.querySelectorAll('.dynamic-ingredient').length;
  newDiv.innerHTML = `<input type="text" name="ingredient" placeholder="Bahan ${currentCount + 1}" style="flex:1;"><button type="button" class="remove-ingredient-btn" style="background:#a94442; color:white; border:none; padding:0 12px; border-radius:20px;">Hapus</button>`;
  container.appendChild(newDiv);
  newDiv.querySelector('.remove-ingredient-btn').addEventListener('click', () => { newDiv.remove(); renumberIngredients(); });
  renumberIngredients();
}
function addStepField() {
  const container = document.getElementById('stepsContainer');
  const newDiv = document.createElement('div');
  newDiv.className = 'dynamic-step';
  newDiv.style.display = 'flex'; newDiv.style.gap = '8px'; newDiv.style.marginBottom = '8px';
  const currentCount = container.querySelectorAll('.dynamic-step').length;
  newDiv.innerHTML = `<input type="text" name="step" placeholder="Langkah ${currentCount + 1}" style="flex:1;"><button type="button" class="remove-step-btn" style="background:#a94442; color:white; border:none; padding:0 12px; border-radius:20px;">Hapus</button>`;
  container.appendChild(newDiv);
  newDiv.querySelector('.remove-step-btn').addEventListener('click', () => { newDiv.remove(); renumberSteps(); });
  renumberSteps();
}

function renderTambahResep() {
  if(!currentUser || currentUser.role_type === 'ADMIN') return `<div class="not-found">Silakan login sebagai User untuk menambah resep.</div>`;
  return `<div class="page-header"><h2>Tambah Resep</h2></div>
    <div class="add-recipe-form">
      <form id="formTambahResep">
        <div class="form-grid">
          <div class="form-row"><label>Nama Resep *</label><input type="text" id="recipeName" required></div>
          <div class="form-row"><label>Kategori</label><select id="recipeCategory">${categoriesList.map(c=>`<option>${c}</option>`).join('')}</select></div>
          <div class="form-row"><label>Deskripsi</label><input type="text" id="recipeDesc" placeholder="Deskripsi singkat resep"></div>
          <div class="form-row"><label>Foto Makanan (JPG/PNG)</label><input type="file" id="recipeImageFile" accept="image/jpeg,image/png"></div>
          <div id="imagePreviewContainer" style="display:none;"><img id="imagePreview" class="image-preview" alt="Preview"></div>
          <div class="form-row"><label>Bahan-bahan</label><div id="ingredientsContainer"><div class="dynamic-ingredient" style="display:flex; gap:8px; margin-bottom:8px;"><input type="text" name="ingredient" placeholder="Bahan 1" style="flex:1;"><button type="button" class="remove-ingredient-btn" style="background:#a94442; color:white; border:none; padding:0 12px; border-radius:20px;">Hapus</button></div></div><button type="button" id="addIngredientBtn" class="btn-submit" style="background:var(--brown-medium); padding:0.5rem; margin-top:0;">+ Tambah Bahan</button></div>
          <div class="form-row"><label>Langkah-langkah</label><div id="stepsContainer"><div class="dynamic-step" style="display:flex; gap:8px; margin-bottom:8px;"><input type="text" name="step" placeholder="Langkah 1" style="flex:1;"><button type="button" class="remove-step-btn" style="background:#a94442; color:white; border:none; padding:0 12px; border-radius:20px;">Hapus</button></div></div><button type="button" id="addStepBtn" class="btn-submit" style="background:var(--brown-medium); padding:0.5rem; margin-top:0;">+ Tambah Langkah</button></div>
          <button type="submit" class="btn-submit">Simpan Resep</button>
        </div>
      </form>
    </div>`;
}

// ========== PROFIL HANYA UNTUK USER BIASA (TIDAK UNTUK ADMIN) ==========
function renderProfil() {
  if(!currentUser) return `<div class="not-found">Login untuk melihat profil.</div>`;
  // Jika admin mencoba mengakses, tampilkan pesan akses ditolak
  if(currentUser.role_type === 'ADMIN') {
    return `<div class="not-found">Fitur Profil tidak tersedia untuk Admin. Gunakan Dashboard Admin.</div>`;
  }
  return `<div class="page-header"><h2>Profil ${currentUser.username}</h2></div>
    <div class="profile-stats"><span>Role: User Biasa</span></div>
    <h3>Resep yang Anda unggah:</h3>
    <div class="recipes-grid">${renderRecipes(getUserUploadedRecipes(), true)}</div>`;
}

// ========== DASHBOARD ADMIN ==========
function renderAdminDashboard() {
  if (!currentUser || currentUser.role_type !== 'ADMIN') {
    return `<div class="not-found">Akses ditolak.</div>`;
  }

  const allRecipes = getAllRecipes();
  const totalRecipes = allRecipes.length;

  let totalComments = 0;
  for (let recipe of allRecipes) {
    totalComments += getComments(recipe.id).length;
  }

  return `
    <div class="page-header">
      <h2>Dashboard Admin</h2>
      <p style="color: var(--brown-dark); margin-top: 0.5rem;">Selamat datang, <strong>${currentUser.username}</strong> (Administrator)</p>
    </div>

    <div class="profile-stats" style="display: flex; gap: 1.5rem; justify-content: space-around; flex-wrap: wrap;">
      <div style="background: var(--green-pale); padding: 0.8rem 1.5rem; border-radius: 2rem; text-align: center;">
        <div style="font-size: 1.8rem; font-weight: bold;">${totalRecipes}</div>
        <div style="font-size: 0.8rem;">Total Resep</div>
      </div>
      <div style="background: var(--green-pale); padding: 0.8rem 1.5rem; border-radius: 2rem; text-align: center;">
        <div style="font-size: 1.8rem; font-weight: bold;">${totalComments}</div>
        <div style="font-size: 0.8rem;">Total Komentar</div>
      </div>
    </div>

    <div style="display: flex; justify-content: center; margin: 1.5rem 0;">
      <button id="fullHistoryBtn" class="btn-submit" style="background: var(--brown-dark); padding: 0.8rem 2rem; font-size: 1rem; display: inline-flex; align-items: center; gap: 10px;">
        <i class="fas fa-history"></i> 📜 Lihat Seluruh History Komentar (Lengkap dengan Tanggal Resep)
      </button>
    </div>

    <h3 style="margin-top: 1rem;">📋 Manajemen Semua Resep</h3>
    <div class="recipes-grid">
      ${renderRecipes(allRecipes, true)}
    </div>
  `;
}

// ---------- MODAL DETAIL RESEP ----------
let currentModalRecipe = null;
let selectedRating = 0;
async function openModal(recipe) {
  currentModalRecipe = recipe;
  const modal = document.getElementById('recipeModal');
  await fetchCommentsFromAPI(recipe.id);
  const avgRating = getRecipeRating(recipe.id);
  const userRating = getUserRating(recipe.id);
  const userCommentText = getUserCommentText(recipe.id);
  const imgSource = recipe.imageUrl || placeholderImage;
  let modalHTML = `
    <button class="close-modal" id="closeModalBtn">&times;</button>
    <img class="modal-img" src="${imgSource}" alt="${recipe.name}" onerror="this.src='${placeholderImage}'">
    <h2 style="color: var(--brown-dark); margin-bottom: 0.5rem;">${recipe.name}</h2>
    <div style="margin-bottom: 0.8rem;">
      <span style="background: var(--green-pale); padding: 0.2rem 0.8rem; border-radius: 20px; font-size: 0.8rem;">🏷️ ${recipe.category}</span>
      <span style="background: var(--green-pale); padding: 0.2rem 0.8rem; border-radius: 20px; font-size: 0.8rem; margin-left: 0.5rem;">📍 ${recipe.region}</span>
    </div>
    <div style="margin-bottom: 0.8rem;"><div><strong>Rata-rata:</strong> ${renderStars(avgRating, true)}</div></div>
    <h3>Deskripsi:</h3><p style="margin-bottom: 1rem;">${recipe.description}</p>
    <h3>Bahan - bahan:</h3>
    <ul style="margin-bottom: 1rem; margin-left: 1.5rem;">${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
    <h3>Langkah - langkah:</h3>
    <ol style="margin-bottom: 1rem; margin-left: 1.5rem;">${recipe.steps.map((s,i)=>`<li>${s}</li>`).join('')}</ol>
  `;
  const comments = getComments(recipe.id);
  let commentsHTML = `<h3>Komentar & Rating Pengguna Lain</h3>`;
  commentsHTML += comments.length ? comments.map((c) => {
    const canDelete = (currentUser && (currentUser.role_type === 'ADMIN' || c.userId === currentUser.email));
    return `<div class="comment-item"><strong>${c.userName}</strong> ${renderStars(c.rating, false)}<br><small>${c.date}</small><p>${c.text}</p>${canDelete ? `<button class="delete-comment-btn" data-recipe="${recipe.id}" data-comment-id="${c.id}">Hapus</button>` : ''}</div>`;
  }).join('') : '<p>Belum ada komentar.</p>';
  let ratingFormHTML = '';
  if(!currentUser) ratingFormHTML = `<div class="login-prompt">Login untuk memberi rating & komentar.</div>`;
  else ratingFormHTML = `
    <div style="margin-top:1.5rem; border-top:1px solid var(--brown-light); padding-top:1rem;">
      <h3>Berikan Rating & Komentar</h3>
      <input type="text" id="commenterName" placeholder="Nama" style="width:100%; margin-bottom:8px;" value="${currentUser.username}">
      <textarea id="commentText" rows="2" placeholder="Komentar Anda..." style="width:100%; margin-bottom:8px;">${userCommentText}</textarea>
      <div class="star-rating-input" id="starRatingInputModal">
        <i class="far fa-star" data-rating="1"></i><i class="far fa-star" data-rating="2"></i>
        <i class="far fa-star" data-rating="3"></i><i class="far fa-star" data-rating="4"></i><i class="far fa-star" data-rating="5"></i>
      </div>
      <button id="submitRatingBtn" class="btn-submit" style="margin-top:12px;">Kirim Rating & Komentar</button>
    </div>
  `;
  const modalContent = document.querySelector('#recipeModal .modal-content');
  modalContent.innerHTML = modalHTML + commentsHTML + `<div id="ratingFormContainer">${ratingFormHTML}</div>`;
  document.getElementById('closeModalBtn').onclick = () => { modal.style.display = 'none'; document.body.style.overflow = ''; };
  if(currentUser) {
    const stars = document.querySelectorAll('#starRatingInputModal i');
    const existingRating = getUserRating(recipe.id);
    if(existingRating) { selectedRating = existingRating; stars.forEach(star => { if(parseInt(star.getAttribute('data-rating')) <= existingRating) { star.classList.remove('far'); star.classList.add('fas','selected'); } }); }
    else selectedRating = 0;
    stars.forEach(star => star.onclick = () => {
      selectedRating = parseInt(star.getAttribute('data-rating'));
      stars.forEach(s => { if(parseInt(s.getAttribute('data-rating')) <= selectedRating) { s.classList.remove('far'); s.classList.add('fas','selected'); } else { s.classList.remove('fas','selected'); s.classList.add('far'); } });
    });
    document.getElementById('submitRatingBtn').onclick = async () => {
      if(!currentUser) return showToast('Login dulu', 'error');
      if(selectedRating === 0) return showToast('Pilih rating bintang 1-5', 'error');
      const name = document.getElementById('commenterName').value.trim() || currentUser.username;
      const comment = document.getElementById('commentText').value.trim();
      try {
        await submitComment(recipe.id, name, comment, selectedRating);
        await openModal(recipe);
      } catch (error) { console.error(error); showToast(error.message || 'Gagal menyimpan komentar', 'error'); }
    };
  }
  document.querySelectorAll('.delete-comment-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const recipeId = parseInt(btn.getAttribute('data-recipe'));
      const commentId = parseInt(btn.getAttribute('data-comment-id'));
      try { await deleteCommentFromAPI(commentId, recipeId); await openModal(recipe); }
      catch (error) { console.error(error); showToast(error.message || 'Gagal menghapus komentar', 'error'); }
    };
  });
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// ---------- EVENT HANDLER ----------
function attachCardEvents() {
  document.querySelectorAll('.favorite-star').forEach(el => { el.removeEventListener('click', favHandler); el.addEventListener('click', favHandler); });
  document.querySelectorAll('.view-detail').forEach(btn => { btn.removeEventListener('click', detailHandler); btn.addEventListener('click', detailHandler); });
  document.querySelectorAll('.delete-recipe-btn').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); deleteRecipeWithConfirm(parseInt(btn.getAttribute('data-id'))); });
}
function favHandler(e) { e.stopPropagation(); toggleFavorite(parseInt(e.currentTarget.getAttribute('data-id'))); }
function detailHandler(e) { const id = parseInt(e.currentTarget.getAttribute('data-id')); const recipe = getAllRecipes().find(r => r.id === id); if(recipe) openModal(recipe); }
function attachCategoryChips() { document.querySelectorAll('.cat-chip').forEach(chip => chip.onclick = () => { activeCategory = chip.getAttribute('data-cat'); renderCurrentView(); }); }

function attachFormSubmit() {
  const form = document.getElementById('formTambahResep');
  if(!form) return;
  const addIngredientBtn = document.getElementById('addIngredientBtn');
  const addStepBtn = document.getElementById('addStepBtn');
  if(addIngredientBtn) addIngredientBtn.onclick = () => addIngredientField();
  if(addStepBtn) addStepBtn.onclick = () => addStepField();
  initDynamicForm();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('recipeName').value.trim();
    if(!name) return showToast('Nama resep wajib', 'error');
    const ingredientInputs = document.querySelectorAll('#ingredientsContainer input[name="ingredient"]');
    const ingredients = Array.from(ingredientInputs).map(inp => inp.value.trim()).filter(v => v !== "");
    if(ingredients.length === 0) return showToast('Minimal satu bahan', 'error');
    const stepInputs = document.querySelectorAll('#stepsContainer input[name="step"]');
    const steps = Array.from(stepInputs).map(inp => inp.value.trim()).filter(v => v !== "");
    if(steps.length === 0) return showToast('Minimal satu langkah', 'error');
    const fileInput = document.getElementById('recipeImageFile');
    let imageBase64 = null;
    if(fileInput.files.length > 0) {
      const file = fileInput.files[0];
      imageBase64 = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = (e) => resolve(e.target.result); reader.readAsDataURL(file); });
    }
    const success = await addNewRecipe({
      name, category: document.getElementById('recipeCategory').value, region: "Tidak disebutkan",
      description: document.getElementById('recipeDesc').value.trim() || "Resep lezat", time: "30 menit", difficulty: "Sedang",
      ingredients, steps
    }, imageBase64);
    if(success) { currentView = "home"; renderCurrentView(); highlightNav(); }
  };
  const fileInput = document.getElementById('recipeImageFile');
  const previewContainer = document.getElementById('imagePreviewContainer');
  const previewImg = document.getElementById('imagePreview');
  if(fileInput) fileInput.onchange = () => {
    if(fileInput.files.length) { const reader = new FileReader(); reader.onload = (e) => { previewImg.src = e.target.result; previewContainer.style.display = 'block'; }; reader.readAsDataURL(fileInput.files[0]); }
    else previewContainer.style.display = 'none';
  };
}

function renderCurrentView() {
  const main = document.getElementById('mainContent');
  if(!main) return;
  if(currentView === 'home') main.innerHTML = renderHome();
  else if(currentView === 'kategori') main.innerHTML = renderKategori();
  else if(currentView === 'favorite') main.innerHTML = renderFavorite();
  else if(currentView === 'tambah') main.innerHTML = renderTambahResep();
  else if(currentView === 'profil') main.innerHTML = renderProfil();
  else if(currentView === 'admin') main.innerHTML = renderAdminDashboard();
  attachCardEvents();
  if(currentView === 'home') { initSlider(); } else { stopSliderInterval(); }
  if(currentView === 'kategori') attachCategoryChips();
  if(currentView === 'tambah') attachFormSubmit();
  if(currentView === 'admin') {
    const historyBtn = document.getElementById('fullHistoryBtn');
    if(historyBtn) historyBtn.onclick = () => openFullCommentHistoryModal();
  }
}

// ========== SETUP NAVIGASI dengan pengecekan akses Profil untuk Admin ==========
function setupNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.currentTarget.getAttribute('data-view');
      // Cegah akses ke halaman Profil jika role admin
      if(view === 'profil' && currentUser && currentUser.role_type === 'ADMIN') {
        showToast('Fitur Profil tidak tersedia untuk Admin.', 'error');
        return;
      }
      if((view === 'tambah' || view === 'favorite') && !currentUser) {
        showToast('Login dulu', 'error'); return;
      }
      if(view === 'admin' && (!currentUser || currentUser.role_type !== 'ADMIN')) {
        showToast('Hanya admin', 'error'); return;
      }
      currentView = view;
      if(view === 'kategori') activeCategory = "Daging";
      highlightNav();
      renderCurrentView();
    });
  });
}

function highlightNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if(btn.getAttribute('data-view') === currentView) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

// ---------- AUTH MODAL ----------
function showAuthModal(registerMode = false) {
  const modal = document.getElementById('authModal');
  document.getElementById('authTitle').innerText = registerMode ? "Daftar" : "Login";
  document.getElementById('authSubmitBtn').innerText = registerMode ? "Daftar" : "Masuk";
  document.getElementById('usernameField').style.display = registerMode ? 'block' : 'none';
  document.getElementById('authSwitchText').innerHTML = registerMode ? `Sudah punya akun? <a href="#" id="switchToLogin">Login</a>` : `Belum punya akun? <a href="#" id="switchToRegister">Daftar</a>`;
  const switchLink = registerMode ? document.getElementById('switchToLogin') : document.getElementById('switchToRegister');
  if(switchLink) switchLink.onclick = (e) => { e.preventDefault(); showAuthModal(!registerMode); };
  document.getElementById('authError').style.display = 'none';
  modal.style.display = 'flex';
  const oldBtn = document.getElementById('authSubmitBtn');
  const newSubmit = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(newSubmit, oldBtn);
  newSubmit.onclick = async () => {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    if(registerMode) {
      const username = document.getElementById('authUsername').value.trim();
      if(!username || !email || password.length < 8) { document.getElementById('authError').innerText = "Isi semua, password min 8 karakter"; document.getElementById('authError').style.display = 'block'; return; }
      try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email, password, role_type: "USER" }) });
        if(response.ok) { alert("Registrasi berhasil! Silakan login."); showAuthModal(false); }
        else { document.getElementById('authError').innerText = "Email sudah terdaftar"; document.getElementById('authError').style.display = 'block'; }
      } catch(e) { console.error(e); }
    } else {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/login?email=${email}&password=${password}`, { method: 'POST' });
        if(response.ok) { const userData = await response.json(); currentUser = userData; saveSession(); updateUIAfterAuth(); closeAuthModal(); renderCurrentView(); showToast('Login Berhasil!', 'success'); }
        else { document.getElementById('authError').innerText = "Email atau password salah"; document.getElementById('authError').style.display = 'block'; }
      } catch(e) { console.error(e); }
    }
  };
}
function closeAuthModal() { document.getElementById('authModal').style.display = 'none'; }

// ========== UPDATE UI SETELAH AUTH (Sembunyikan Tombol Profil untuk Admin) ==========
function updateUIAfterAuth() {
  const g = document.getElementById('userGreeting');
  const a = document.getElementById('authBtn');
  const ad = document.getElementById('adminDashboardBtn');
  const profilBtn = document.querySelector('.nav-btn[data-view="profil"]');
  
  if(currentUser) {
    g.innerText = `Halo, ${currentUser.username}`;
    a.innerText = "Logout";
    a.onclick = () => logoutWithConfirm();
    ad.style.display = currentUser.role_type === 'ADMIN' ? 'inline-flex' : 'none';
    // Sembunyikan tombol Profil jika admin
    if(profilBtn) {
      profilBtn.style.display = currentUser.role_type === 'ADMIN' ? 'none' : 'inline-flex';
    }
    // Jika admin sedang berada di halaman Profil, alihkan ke Dashboard Admin
    if(currentUser.role_type === 'ADMIN' && currentView === 'profil') {
      currentView = 'admin';
      renderCurrentView();
      highlightNav();
    }
  } else {
    g.innerText = "";
    a.innerText = "Login";
    a.onclick = () => showAuthModal(false);
    ad.style.display = 'none';
    if(profilBtn) profilBtn.style.display = 'inline-flex'; // tampilkan untuk user biasa
  }
}

function modalInit() {
  const modal = document.getElementById('recipeModal');
  window.onclick = (e) => { if(e.target === modal) { modal.style.display = 'none'; document.body.style.overflow = ''; } };
  document.getElementById('closeAuthModal').onclick = () => closeAuthModal();
  window.addEventListener('click', (e) => { if(e.target === document.getElementById('authModal')) closeAuthModal(); });
}

// ---------- INIT ----------
loadAllData();
setupNav();
modalInit();
updateUIAfterAuth();
fetchRecipesFromAPI();
