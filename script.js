// ---------- KONFIGURASI API BACKEND ----------
const API_BASE_URL = 'https://backend-ourrecepi-production.up.railway.app/api';
let apiRecipes = []; // Menyimpan data asli dari database

const placeholderImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23d8b48c'/%3E%3Ctext x='50' y='55' font-size='14' text-anchor='middle' fill='%235c3e2b'%3E🍽️%3C/text%3E%3C/svg%3E";
const categoriesList = ["Daging", "Ayam", "Ikan/Seafood", "Sayur", "Nasi", "Jajanan"];

// ---------- STORAGE LOKAL (Hanya untuk Sesi Login, Favorit, dan Rating) ----------
let currentUser = null;
let favorites = new Set();
let ratingsData = {};

function loadAllData() {
  const storedRatings = localStorage.getItem("nusantara_ratings");
  ratingsData = storedRatings ? JSON.parse(storedRatings) : {};
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

function saveRatings() { localStorage.setItem("nusantara_ratings", JSON.stringify(ratingsData)); }
function saveSession() {
  if(currentUser) localStorage.setItem("nusantara_session", JSON.stringify(currentUser));
  else localStorage.removeItem("nusantara_session");
}
function saveFavorites() { if(currentUser) localStorage.setItem(`fav_${currentUser.email}`, JSON.stringify([...favorites])); }


// ---------- MENGAMBIL DATA DARI BACKEND ----------
async function fetchRecipesFromAPI() {
  try {
    const response = await fetch(`${API_BASE_URL}/recipes`);
    if (response.ok) {
      apiRecipes = await response.json();
      renderCurrentView(); // Perbarui tampilan setelah data masuk
    }
  } catch (error) {
    console.error("Gagal mengambil resep dari server:", error);
  }
}

function getAllRecipes() { return apiRecipes; }
function getUserUploadedRecipes() { 
    return currentUser ? apiRecipes.filter(r => r.author && r.author.email === currentUser.email) : []; 
}


// ---------- RATING & COMMENTS (Disimpan lokal sementara waktu) ----------
function updateAverageRating(recipeId) {
  const rid = recipeId.toString();
  if(ratingsData[rid] && ratingsData[rid].comments.length) {
    const sum = ratingsData[rid].comments.reduce((a,c) => a + c.rating, 0);
    ratingsData[rid].avgRating = sum / ratingsData[rid].comments.length;
  } else if(ratingsData[rid]) ratingsData[rid].avgRating = 0;
  else ratingsData[rid] = { comments: [], avgRating: 0 };
  saveRatings();
}

function addOrUpdateComment(recipeId, userName, commentText, ratingValue, userId) {
  const rid = recipeId.toString();
  if(!ratingsData[rid]) ratingsData[rid] = { comments: [], avgRating: 0 };
  
  const existingIndex = ratingsData[rid].comments.findIndex(c => c.userId === userId);
  const now = new Date().toLocaleString();
  const newComment = { name: userName.trim() || "Anonim", text: commentText.trim() || "(Tanpa komentar)", rating: ratingValue, userId: userId, date: now };
  
  if(existingIndex !== -1) {
    ratingsData[rid].comments[existingIndex] = newComment;
    showToast('Rating dan komentar diperbarui', 'success');
  } else {
    ratingsData[rid].comments.unshift(newComment);
    showToast('Rating berhasil dikirim', 'success');
  }
  updateAverageRating(recipeId);
  saveRatings();
}

function getRecipeRating(recipeId) { return ratingsData[recipeId.toString()]?.avgRating || 0; }
function getComments(recipeId) { return ratingsData[recipeId.toString()]?.comments || []; }
function getUserRating(recipeId) {
  if(!currentUser) return null;
  const rid = recipeId.toString();
  const userComment = ratingsData[rid]?.comments.find(c => c.userId === currentUser.email);
  return userComment ? userComment.rating : null;
}
function getUserCommentText(recipeId) {
  if(!currentUser) return "";
  const rid = recipeId.toString();
  const userComment = ratingsData[rid]?.comments.find(c => c.userId === currentUser.email);
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

function deleteCommentWithConfirm(recipeId, commentIndex, userId, element) {
  showConfirm('Hapus komentar ini?', () => {
    const rid = recipeId.toString();
    if(ratingsData[rid] && ratingsData[rid].comments[commentIndex]) {
      const comment = ratingsData[rid].comments[commentIndex];
      // Karena backend kita pakai tipe "role_type", periksa Admin via string role_type
      if(currentUser && (currentUser.role_type === 'ADMIN' || comment.userId === currentUser.email)) {
        ratingsData[rid].comments.splice(commentIndex, 1);
        updateAverageRating(recipeId);
        saveRatings();
        showToast('Komentar dihapus', 'success');
        if(currentModalRecipe && currentModalRecipe.id == recipeId) openModal(currentModalRecipe);
        else renderCurrentView();
      } else showToast('Tidak punya izin', 'error');
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


// ---------- TAMBAH DAN HAPUS RESEP KE BACKEND ----------
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
      ingredients: recipeData.ingredients.split(',').map(i => i.trim()),
      steps: recipeData.steps.split('\n').filter(s => s.trim())
  };

  try {
      const response = await fetch(`${API_BASE_URL}/recipes?userId=${currentUser.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRecipePayload)
      });
      
      if(response.ok) {
          showToast('Resep berhasil ditambahkan ke Database!', 'success');
          fetchRecipesFromAPI(); // Ambil ulang data
          return true;
      } else {
          showToast('Gagal menambahkan resep, Anda bukan User biasa', 'error');
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
            const response = await fetch(`${API_BASE_URL}/recipes/${recipeId}?requesterId=${currentUser.id}`, {
                method: 'DELETE'
            });
            
            if(response.ok) {
                showToast('Resep dihapus dari Database', 'success');
                fetchRecipesFromAPI();
            } else {
                showToast('Anda tidak memiliki izin menghapus resep ini', 'error');
            }
        } catch (e) {
            console.error(e);
        }
    }
  });
}


// ---------- RENDER TAMPILAN ----------
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
    
    // Periksa izin hapus: Admin atau Pemilik Resep
    const isOwner = currentUser && recipe.author && recipe.author.email === currentUser.email;
    const isAdmin = currentUser && currentUser.role_type === 'ADMIN';
    if(showDeleteForOwner && (isOwner || isAdmin)) {
      deleteBtn = `<button class="btn-delete delete-recipe-btn" data-id="${recipe.id}"><i class="fas fa-trash"></i> Hapus Resep</button>`;
    }
    
    // Fallback jika tidak ada gambar
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

function renderHome() {
  const popular = getAllRecipes().slice(0,6); // Ambil 6 terbaru/pertama
  return `<div class="page-header"><h2>Semua Resep Nusantara</h2></div><div class="recipes-grid">${renderRecipes(popular, true)}</div>`;
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

function renderTambahResep() {
  if(!currentUser || currentUser.role_type === 'ADMIN') return `<div class="not-found">Silakan login sebagai User untuk menambah resep.</div>`;
  return `<div class="page-header"><h2>Tambah Resep</h2></div>
    <div class="add-recipe-form">
      <form id="formTambahResep">
        <div class="form-grid">
          <div class="form-row"><label>Nama Resep *</label><input type="text" id="recipeName" required></div>
          <div class="form-row"><label>Kategori</label><select id="recipeCategory">${categoriesList.map(c=>`<option>${c}</option>`).join('')}</select></div>
          <div class="form-row"><label>Daerah Asal</label><input type="text" id="recipeRegion" placeholder="Contoh: Jawa Barat"></div>
          <div class="form-row"><label>Deskripsi</label><input type="text" id="recipeDesc"></div>
          <div class="form-row"><label>Waktu Masak</label><input type="text" id="recipeTime" placeholder="45 menit"></div>
          <div class="form-row"><label>Kesulitan</label><select id="recipeDifficulty"><option>Mudah</option><option>Sedang</option><option>Sulit</option></select></div>
          <div class="form-row"><label>Foto Makanan (JPG/PNG)</label><input type="file" id="recipeImageFile" accept="image/jpeg,image/png"></div>
          <div id="imagePreviewContainer" style="display:none;"><img id="imagePreview" class="image-preview" alt="Preview"></div>
          <div class="form-row"><label>Bahan (pisahkan koma)</label><textarea id="recipeIngredients" rows="2"></textarea></div>
          <div class="form-row"><label>Langkah (baris baru)</label><textarea id="recipeSteps" rows="4"></textarea></div>
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
      <div class="admin-section"><h3>Semua Resep (Bisa dihapus)</h3><div class="recipes-grid">${renderRecipes(allRecipes, true)}</div></div>
    </div>`;
}


// ---------- MODAL DETAIL RESEP ----------
let currentModalRecipe = null;
let selectedRating = 0;

function openModal(recipe) {
  currentModalRecipe = recipe;
  const modal = document.getElementById('recipeModal');
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
    <div style="margin-bottom: 0.8rem;">
      <div><strong>Rata-rata:</strong> ${renderStars(avgRating, true)}</div>
    </div>
    <h3>Deskripsi:</h3><p style="margin-bottom: 1rem;">${recipe.description}</p>
    <h3>Bahan - bahan:</h3>
    <ul style="margin-bottom: 1rem; margin-left: 1.5rem;">
      ${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}
    </ul>
    <h3>Langkah - langkah:</h3>
    <ol style="margin-bottom: 1rem; margin-left: 1.5rem;">
      ${recipe.steps.map((s, i) => `<li>${s}</li>`).join('')}
    </ol>
  `;
  
  const comments = getComments(recipe.id);
  let commentsHTML = `<h3>Komentar & Rating Pengguna Lain</h3>`;
  commentsHTML += comments.length ? comments.map((c, idx) => {
    const canDelete = (currentUser && (currentUser.role_type === 'ADMIN' || c.userId === currentUser.email));
    return `<div class="comment-item" data-comment-idx="${idx}">
              <strong>${c.name}</strong> ${renderStars(c.rating, false)}<br>
              <small>${c.date}</small>
              <p>${c.text}</p>
              ${canDelete ? `<button class="delete-comment-btn" data-recipe="${recipe.id}" data-idx="${idx}">Hapus</button>` : ''}
            </div>`;
  }).join('') : '<p>Belum ada komentar.</p>';
  
  let ratingFormHTML = '';
  if(!currentUser) {
    ratingFormHTML = `<div class="login-prompt">Login untuk memberi rating & komentar.</div>`;
  } else {
    ratingFormHTML = `
      <div style="margin-top: 1.5rem; border-top: 1px solid var(--brown-light); padding-top: 1rem;">
        <h3>Berikan Rating & Komentar</h3>
        <input type="text" id="commenterName" placeholder="Nama" style="width:100%; margin-bottom:8px;" value="${currentUser.username}">
        <textarea id="commentText" rows="2" placeholder="Komentar Anda..." style="width:100%; margin-bottom:8px;">${userCommentText !== "(Tanpa komentar)" ? userCommentText : ""}</textarea>
        <div class="star-rating-input" id="starRatingInputModal">
          <i class="far fa-star" data-rating="1"></i><i class="far fa-star" data-rating="2"></i>
          <i class="far fa-star" data-rating="3"></i><i class="far fa-star" data-rating="4"></i><i class="far fa-star" data-rating="5"></i>
        </div>
        <button id="submitRatingBtn" class="btn-submit" style="margin-top:12px;">Kirim Rating & Komentar</button>
      </div>
    `;
  }
  
  const modalContent = document.querySelector('#recipeModal .modal-content');
  modalContent.innerHTML = modalHTML + commentsHTML + `<div id="ratingFormContainer">${ratingFormHTML}</div>`;
  
  document.getElementById('closeModalBtn').onclick = () => { modal.style.display = 'none'; document.body.style.overflow = ''; };
  
  if(currentUser) {
    const stars = document.querySelectorAll('#starRatingInputModal i');
    const existingRating = getUserRating(recipe.id);
    if(existingRating) {
      selectedRating = existingRating;
      stars.forEach(star => {
        const ratingVal = parseInt(star.getAttribute('data-rating'));
        if(ratingVal <= existingRating) { star.classList.remove('far'); star.classList.add('fas','selected'); }
      });
    } else selectedRating = 0;
    
    stars.forEach(star => star.onclick = () => {
      selectedRating = parseInt(star.getAttribute('data-rating'));
      stars.forEach(s => {
        if(parseInt(s.getAttribute('data-rating')) <= selectedRating) { s.classList.remove('far'); s.classList.add('fas','selected'); }
        else { s.classList.remove('fas','selected'); s.classList.add('far'); }
      });
    });
    
    document.getElementById('submitRatingBtn').onclick = () => {
      if(!currentUser) return showToast('Login dulu', 'error');
      if(selectedRating === 0) return showToast('Pilih rating bintang 1-5', 'error');
      const name = document.getElementById('commenterName').value.trim() || currentUser.username;
      const comment = document.getElementById('commentText').value.trim();
      addOrUpdateComment(recipe.id, name, comment, selectedRating, currentUser.email);
      openModal(recipe); 
    };
  }
  
  document.querySelectorAll('.delete-comment-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const recipeId = parseInt(btn.getAttribute('data-recipe'));
      const idx = parseInt(btn.getAttribute('data-idx'));
      const commentDivElement = btn.closest('.comment-item');
      deleteCommentWithConfirm(recipeId, idx, currentUser?.email, commentDivElement);
    };
  });
  
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}


// ---------- EVENT HANDLERS & ROUTING ----------
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
  if(form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById('recipeName').value.trim();
      if(!name) return showToast('Nama resep wajib', 'error');
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
        region: document.getElementById('recipeRegion').value.trim() || "Nusantara",
        description: document.getElementById('recipeDesc').value.trim() || "Resep lezat",
        time: document.getElementById('recipeTime').value.trim() || "30 menit",
        difficulty: document.getElementById('recipeDifficulty').value,
        ingredients: document.getElementById('recipeIngredients').value,
        steps: document.getElementById('recipeSteps').value
      }, imageBase64);
      
      if(success) { currentView = "home"; renderCurrentView(); highlightNav(); }
    };
    
    const fileInput = document.getElementById('recipeImageFile');
    const previewContainer = document.getElementById('imagePreviewContainer');
    const previewImg = document.getElementById('imagePreview');
    fileInput.onchange = (e) => {
      if(fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => { previewImg.src = ev.target.result; previewContainer.style.display = 'block'; };
        reader.readAsDataURL(file);
      } else { previewContainer.style.display = 'none'; }
    };
  }
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
  if(currentView === 'kategori') attachCategoryChips();
  if(currentView === 'tambah') attachFormSubmit();
}

function setupNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.currentTarget.getAttribute('data-view');
      if((view === 'tambah' || view === 'favorite' || view === 'profil') && !currentUser) {
        showToast('Login dulu untuk mengakses halaman ini', 'error'); return;
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


// ---------- MODAL LOGIN / REGISTER (API) ----------
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
        // Karena inheritance OOP, kita tembak register sebagai RegularUser secara default
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, role_type: "USER" })
        });
        if(response.ok) {
            alert("Registrasi berhasil! Silakan login.");
            showAuthModal(false);
        } else {
            document.getElementById('authError').innerText = "Email sudah terdaftar"; 
            document.getElementById('authError').style.display = 'block';
        }
      } catch (e) { console.error(e); }
      
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
      } catch (e) { console.error(e); }
    }
  };
}

function closeAuthModal() { document.getElementById('authModal').style.display = 'none'; }
function updateUIAfterAuth() {
  const g = document.getElementById('userGreeting'), a = document.getElementById('authBtn'), ad = document.getElementById('adminDashboardBtn');
  if(currentUser) { 
    g.innerText = `Halo, ${currentUser.username}`; 
    a.innerText = "Logout"; 
    a.onclick = () => logoutWithConfirm(); 
    ad.style.display = currentUser.role_type === 'ADMIN' ? 'inline-flex' : 'none'; 
  } else { 
    g.innerText = ""; 
    a.innerText = "Login"; 
    a.onclick = () => showAuthModal(false); 
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
fetchRecipesFromAPI(); // Otomatis menarik data resep dari Backend Spring Boot
