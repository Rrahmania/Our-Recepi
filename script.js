
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

// ---------- RATING & COMMENTS ----------
async function submitComment(recipeId, userName, commentText, ratingValue) {
  if (!currentUser) throw new Error('Login dulu');
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

// ---------- TAMBAH RESEP (DENGAN BAHAN & LANGKAH DINAMIS) ----------
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

// ========== SLIDER DENGAN 5 GAMBAR MAKANAN TETAP ==========
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
    // Data 5 makanan nusantara dengan gambar asli (Unsplash)
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
      },
      {
        name: "Bakso",
        region: "Jawa Timur",
        imageUrl: "data:image/jpeg;base64,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",
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

// ========== RENDER HOME DENGAN SLIDER ==========
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

// ========== FUNGSI UNTUK RENUMBER BAHAN DAN LANGKAH (OTOMATIS) ==========
function renumberIngredients() {
  const containers = document.querySelectorAll('#ingredientsContainer .dynamic-ingredient');
  containers.forEach((container, idx) => {
    const input = container.querySelector('input[name="ingredient"]');
    if (input) {
      input.placeholder = `Bahan ${idx + 1}`;
    }
  });
}

function renumberSteps() {
  const containers = document.querySelectorAll('#stepsContainer .dynamic-step');
  containers.forEach((container, idx) => {
    const input = container.querySelector('input[name="step"]');
    if (input) {
      input.placeholder = `Langkah ${idx + 1}`;
    }
  });
}

function initDynamicForm() {
  // Tombol hapus bahan
  document.querySelectorAll('#ingredientsContainer .remove-ingredient-btn').forEach(btn => {
    btn.removeEventListener('click', btn._listener);
    const newListener = function() {
      this.closest('.dynamic-ingredient').remove();
      renumberIngredients();
    };
    btn.addEventListener('click', newListener);
    btn._listener = newListener;
  });
  
  // Tombol hapus langkah
  document.querySelectorAll('#stepsContainer .remove-step-btn').forEach(btn => {
    btn.removeEventListener('click', btn._listener);
    const newListener = function() {
      this.closest('.dynamic-step').remove();
      renumberSteps();
    };
    btn.addEventListener('click', newListener);
    btn._listener = newListener;
  });
  
  renumberIngredients();
  renumberSteps();
}

// ---- FUNGSI TAMBAH BAHAN & LANGKAH DENGAN RENUMBER ----
function addIngredientField() {
  const container = document.getElementById('ingredientsContainer');
  const newDiv = document.createElement('div');
  newDiv.className = 'dynamic-ingredient';
  newDiv.style.display = 'flex';
  newDiv.style.gap = '8px';
  newDiv.style.marginBottom = '8px';
  const currentCount = container.querySelectorAll('.dynamic-ingredient').length;
  newDiv.innerHTML = `
    <input type="text" name="ingredient" placeholder="Bahan ${currentCount + 1}" style="flex:1;">
    <button type="button" class="remove-ingredient-btn" style="background:#a94442; color:white; border:none; padding:0 12px; border-radius:20px;">Hapus</button>
  `;
  container.appendChild(newDiv);
  const delBtn = newDiv.querySelector('.remove-ingredient-btn');
  delBtn.addEventListener('click', function() {
    newDiv.remove();
    renumberIngredients();
  });
  renumberIngredients();
}

function addStepField() {
  const container = document.getElementById('stepsContainer');
  const newDiv = document.createElement('div');
  newDiv.className = 'dynamic-step';
  newDiv.style.display = 'flex';
  newDiv.style.gap = '8px';
  newDiv.style.marginBottom = '8px';
  const currentCount = container.querySelectorAll('.dynamic-step').length;
  newDiv.innerHTML = `
    <input type="text" name="step" placeholder="Langkah ${currentCount + 1}" style="flex:1;">
    <button type="button" class="remove-step-btn" style="background:#a94442; color:white; border:none; padding:0 12px; border-radius:20px;">Hapus</button>
  `;
  container.appendChild(newDiv);
  const delBtn = newDiv.querySelector('.remove-step-btn');
  delBtn.addEventListener('click', function() {
    newDiv.remove();
    renumberSteps();
  });
  renumberSteps();
}

// ---------- FORM TAMBAH RESEP (TANPA DAERAH, WAKTU, KESULITAN) ----------
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
          
          <div class="form-row">
            <label>Bahan-bahan</label>
            <div id="ingredientsContainer">
              <div class="dynamic-ingredient" style="display:flex; gap:8px; margin-bottom:8px;">
                <input type="text" name="ingredient" placeholder="Bahan 1" style="flex:1;">
                <button type="button" class="remove-ingredient-btn" style="background:#a94442; color:white; border:none; padding:0 12px; border-radius:20px;">Hapus</button>
              </div>
            </div>
            <button type="button" id="addIngredientBtn" class="btn-submit" style="background:var(--brown-medium); padding:0.5rem; margin-top:0;">+ Tambah Bahan</button>
          </div>
          
          <div class="form-row">
            <label>Langkah-langkah</label>
            <div id="stepsContainer">
              <div class="dynamic-step" style="display:flex; gap:8px; margin-bottom:8px;">
                <input type="text" name="step" placeholder="Langkah 1" style="flex:1;">
                <button type="button" class="remove-step-btn" style="background:#a94442; color:white; border:none; padding:0 12px; border-radius:20px;">Hapus</button>
              </div>
            </div>
            <button type="button" id="addStepBtn" class="btn-submit" style="background:var(--brown-medium); padding:0.5rem; margin-top:0;">+ Tambah Langkah</button>
          </div>
          
          <button type="submit" class="btn-submit">Simpan Resep</button>
        </div>
      </form>
    </div>`;
}

function renderProfil() {
  if(!currentUser) return `<div class="not-found">Login untuk melihat profil.</div>`;
  return `<div class="page-header"><h2>Profil ${currentUser.username}</h2></div>
    <div class="profile-stats"><span>Role: ${currentUser.role_type === 'ADMIN' ? 'Admin' : 'User Biasa'}</span></div>
    <h3>Resep yang Anda unggah:</h3>
    <div class="recipes-grid">${renderRecipes(getUserUploadedRecipes(), true)}</div>`;
}
function renderAdminDashboard() {
  if(!currentUser || currentUser.role_type !== 'ADMIN') return `<div class="not-found">Akses ditolak.</div>`;
  const allRecipes = getAllRecipes();
  return `<div class="page-header"><h2>Dashboard Admin</h2></div>
    <div class="admin-dashboard">
      <div class="admin-section"><h3>Semua Resep</h3><div class="recipes-grid">${renderRecipes(allRecipes, true)}</div></div>
    </div>`;
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
    if(existingRating) {
      selectedRating = existingRating;
      stars.forEach(star => { if(parseInt(star.getAttribute('data-rating')) <= existingRating) { star.classList.remove('far'); star.classList.add('fas','selected'); } });
    } else selectedRating = 0;
    stars.forEach(star => star.onclick = () => {
      selectedRating = parseInt(star.getAttribute('data-rating'));
      stars.forEach(s => {
        if(parseInt(s.getAttribute('data-rating')) <= selectedRating) { s.classList.remove('far'); s.classList.add('fas','selected'); }
        else { s.classList.remove('fas','selected'); s.classList.add('far'); }
      });
    });
    document.getElementById('submitRatingBtn').onclick = async () => {
      if(!currentUser) return showToast('Login dulu', 'error');
      if(selectedRating === 0) return showToast('Pilih rating bintang 1-5', 'error');
      const name = document.getElementById('commenterName').value.trim() || currentUser.username;
      const comment = document.getElementById('commentText').value.trim();
      try {
        await submitComment(recipe.id, name, comment, selectedRating);
        await openModal(recipe);
      } catch (error) {
        console.error(error);
        showToast(error.message || 'Gagal menyimpan komentar', 'error');
      }
    };
  }
  document.querySelectorAll('.delete-comment-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const recipeId = parseInt(btn.getAttribute('data-recipe'));
      const commentId = parseInt(btn.getAttribute('data-comment-id'));
      try {
        await deleteCommentFromAPI(commentId, recipeId);
        await openModal(recipe);
      } catch (error) {
        console.error(error);
        showToast(error.message || 'Gagal menghapus komentar', 'error');
      }
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
  
  // Inisialisasi nomor urut dan tombol hapus yang sudah ada
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
      imageBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
    }
    const success = await addNewRecipe({
      name,
      category: document.getElementById('recipeCategory').value,
      region: "Tidak disebutkan",
      description: document.getElementById('recipeDesc').value.trim() || "Resep lezat",
      time: "30 menit",
      difficulty: "Sedang",
      ingredients: ingredients,
      steps: steps
    }, imageBase64);
    if(success) { currentView = "home"; renderCurrentView(); highlightNav(); }
  };
  const fileInput = document.getElementById('recipeImageFile');
  const previewContainer = document.getElementById('imagePreviewContainer');
  const previewImg = document.getElementById('imagePreview');
  if(fileInput) fileInput.onchange = () => {
    if(fileInput.files.length) {
      const reader = new FileReader();
      reader.onload = (e) => { previewImg.src = e.target.result; previewContainer.style.display = 'block'; };
      reader.readAsDataURL(fileInput.files[0]);
    } else previewContainer.style.display = 'none';
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
  
  if(currentView === 'home') {
    initSlider();
  } else {
    stopSliderInterval();
  }
  
  if(currentView === 'kategori') attachCategoryChips();
  if(currentView === 'tambah') attachFormSubmit();
}

function setupNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.currentTarget.getAttribute('data-view');
      if((view === 'tambah' || view === 'favorite' || view === 'profil') && !currentUser) {
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

// ---------- AUTH MODAL (LOGIN/REGISTER) ----------
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
      if(!username || !email || password.length < 8) {
        document.getElementById('authError').innerText = "Isi semua, password min 8 karakter";
        document.getElementById('authError').style.display = 'block'; return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password, role_type: "USER" })
        });
        if(response.ok) { alert("Registrasi berhasil! Silakan login."); showAuthModal(false); }
        else { document.getElementById('authError').innerText = "Email sudah terdaftar"; document.getElementById('authError').style.display = 'block'; }
      } catch(e) { console.error(e); }
    } else {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/login?email=${email}&password=${password}`, { method: 'POST' });
        if(response.ok) {
          const userData = await response.json();
          currentUser = userData;
          saveSession();
          updateUIAfterAuth();
          closeAuthModal();
          renderCurrentView();
          showToast('Login Berhasil!', 'success');
        } else {
          document.getElementById('authError').innerText = "Email atau password salah";
          document.getElementById('authError').style.display = 'block';
        }
      } catch(e) { console.error(e); }
    }
  };
}
function closeAuthModal() { document.getElementById('authModal').style.display = 'none'; }
function updateUIAfterAuth() {
  const g = document.getElementById('userGreeting'), a = document.getElementById('authBtn'), ad = document.getElementById('adminDashboardBtn');
  if(currentUser) {
    g.innerText = `Halo, ${currentUser.username}`;
    a.innerText = "Logout"; a.onclick = () => logoutWithConfirm();
    ad.style.display = currentUser.role_type === 'ADMIN' ? 'inline-flex' : 'none';
  } else {
    g.innerText = ""; a.innerText = "Login"; a.onclick = () => showAuthModal(false);
    ad.style.display = 'none';
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
