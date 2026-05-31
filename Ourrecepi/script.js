// ---------- DATA RESEP DEFAULT (gambar teks) ----------
const placeholderImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23d8b48c'/%3E%3Ctext x='50' y='55' font-size='14' text-anchor='middle' fill='%235c3e2b'%3E🍽️%3C/text%3E%3C/svg%3E";

const defaultRecipes = [
  { id: 1, name: "Rendang", region: "Sumatera Barat", description: "Daging sapi dimasak santan & rempah hingga kering.", time: "180 menit", difficulty: "Menengah", category: "Daging", ingredients: ["500g daging sapi","1 liter santan","Bumbu halus","Daun jeruk, serai"], steps: ["Tumis bumbu","Masukkan daging, santan","Masak hingga kering"], image: "rendang.jpg", userId: "system" },
  { id: 2, name: "Nasi Goreng", region: "Nasional", description: "Nasi goreng pedas manis, favorit.", time: "20 menit", difficulty: "Mudah", category: "Nasi", ingredients: ["Nasi","Bawang","Kecap","Telur"], steps: ["Tumis bumbu","Masukkan nasi","Sajikan"], image: "nasigoreng.jpg", userId: "system" },
  { id: 3, name: "Sate Ayam", region: "Jawa", description: "Sate ayam bumbu kacang.", time: "30 menit", difficulty: "Mudah", category: "Ayam", ingredients: ["500g ayam","Tusuk sate","Bumbu kacang"], steps: ["Tusuk ayam","Bakar","Sajikan"], image: "sate.jpg", userId: "system" },
];

const categoriesList = ["Daging", "Ayam", "Ikan/Seafood", "Sayur", "Nasi", "Jajanan"];

// ---------- STORAGE ----------
let users = [];
let currentUser = null;
let userRecipes = [];
let favorites = new Set();
let ratingsData = {};

// ---------- HELPER STORAGE ----------
function seedAdmin() {
  if(!users.find(u => u.email === "admin@rasa.com")) {
    users.push({ username: "AdminNusantara", email: "admin@rasa.com", password: "admin1234", role: "admin" });
    saveUsers();
  }
}
function loadAllData() {
  const storedUsers = localStorage.getItem("nusantara_users");
  users = storedUsers ? JSON.parse(storedUsers) : [];
  seedAdmin();
  const storedUserRecipes = localStorage.getItem("nusantara_userRecipes");
  userRecipes = storedUserRecipes ? JSON.parse(storedUserRecipes) : [];
  const storedRatings = localStorage.getItem("nusantara_ratings");
  ratingsData = storedRatings ? JSON.parse(storedRatings) : {};
  const storedSession = localStorage.getItem("nusantara_session");
  if(storedSession) {
    const session = JSON.parse(storedSession);
    const found = users.find(u => u.email === session.email);
    if(found) currentUser = found;
  }
  if(currentUser) {
    const favKey = `fav_${currentUser.email}`;
    const storedFav = localStorage.getItem(favKey);
    favorites = storedFav ? new Set(JSON.parse(storedFav)) : new Set();
  } else favorites = new Set();
}
function saveUsers() { localStorage.setItem("nusantara_users", JSON.stringify(users)); }
function saveUserRecipes() { localStorage.setItem("nusantara_userRecipes", JSON.stringify(userRecipes)); }
function saveRatings() { localStorage.setItem("nusantara_ratings", JSON.stringify(ratingsData)); }
function saveSession() {
  if(currentUser) localStorage.setItem("nusantara_session", JSON.stringify({ email: currentUser.email }));
  else localStorage.removeItem("nusantara_session");
}
function saveFavorites() { if(currentUser) localStorage.setItem(`fav_${currentUser.email}`, JSON.stringify([...favorites])); }

function getAllRecipes() { return [...defaultRecipes, ...userRecipes.filter(r => r.userId !== "system")]; }
function getUserUploadedRecipes() { return currentUser ? userRecipes.filter(r => r.userId === currentUser.email) : []; }

// ----- Rating & Comments (dengan update rating tanpa komentar) -----
function updateAverageRating(recipeId) {
  const rid = recipeId.toString();
  if(ratingsData[rid] && ratingsData[rid].comments.length) {
    const sum = ratingsData[rid].comments.reduce((a,c) => a + c.rating, 0);
    ratingsData[rid].avgRating = sum / ratingsData[rid].comments.length;
  } else if(ratingsData[rid]) ratingsData[rid].avgRating = 0;
  else ratingsData[rid] = { comments: [], avgRating: 0 };
  saveRatings();
}

// Fungsi untuk menambah atau memperbarui rating/komentar user
function addOrUpdateComment(recipeId, userName, commentText, ratingValue, userId) {
  const rid = recipeId.toString();
  if(!ratingsData[rid]) ratingsData[rid] = { comments: [], avgRating: 0 };
  
  // Cari apakah user sudah pernah berkomentar
  const existingIndex = ratingsData[rid].comments.findIndex(c => c.userId === userId);
  const now = new Date().toLocaleString();
  const newComment = {
    name: userName.trim() || "Anonim",
    text: commentText.trim() || "(Tanpa komentar)",
    rating: ratingValue,
    userId: userId,
    date: now
  };
  
  if(existingIndex !== -1) {
    // Update existing
    ratingsData[rid].comments[existingIndex] = newComment;
    showToast('Rating dan komentar diperbarui', 'success');
  } else {
    // Tambah baru
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

// Confirm Modal (custom)
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
      if(currentUser && (currentUser.role === 'admin' || comment.userId === currentUser.email)) {
        if(element) {
          element.style.transition = 'opacity 0.2s';
          element.style.opacity = '0';
          setTimeout(() => {
            ratingsData[rid].comments.splice(commentIndex, 1);
            updateAverageRating(recipeId);
            saveRatings();
            showToast('Komentar dihapus', 'success');
            if(currentModalRecipe && currentModalRecipe.id == recipeId) openModal(currentModalRecipe);
            else renderCurrentView();
          }, 150);
        } else {
          ratingsData[rid].comments.splice(commentIndex, 1);
          updateAverageRating(recipeId);
          saveRatings();
          showToast('Komentar dihapus', 'success');
          if(currentModalRecipe && currentModalRecipe.id == recipeId) openModal(currentModalRecipe);
          else renderCurrentView();
        }
      } else showToast('Tidak punya izin', 'error');
    }
  });
}

function deleteRecipeWithConfirm(recipeId) {
  showConfirm('Hapus resep ini secara permanen?', () => {
    const idx = userRecipes.findIndex(r => r.id == recipeId);
    if(idx !== -1) {
      const recipe = userRecipes[idx];
      if(currentUser && (currentUser.role === 'admin' || recipe.userId === currentUser.email)) {
        userRecipes.splice(idx, 1);
        saveUserRecipes();
        delete ratingsData[recipeId.toString()];
        saveRatings();
        showToast('Resep dihapus', 'success');
        renderCurrentView();
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
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.backgroundColor = type === 'success' ? '#2e5a2b' : '#a94442';
  toast.style.color = 'white';
  toast.style.padding = '10px 20px';
  toast.style.borderRadius = '40px';
  toast.style.fontSize = '0.9rem';
  toast.style.zIndex = '9999';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  toast.style.fontWeight = '500';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

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

async function addNewRecipe(recipeData, imageBase64) {
  if(!currentUser) { showToast('Login untuk menambah resep', 'error'); return false; }
  const newId = Date.now();
  userRecipes.push({
    id: newId, name: recipeData.name, region: recipeData.region, description: recipeData.description,
    time: recipeData.time, difficulty: recipeData.difficulty, category: recipeData.category,
    ingredients: recipeData.ingredients.split(',').map(i => i.trim()),
    steps: recipeData.steps.split('\n').filter(s => s.trim()), image: imageBase64 || placeholderImage, userId: currentUser.email
  });
  saveUserRecipes();
  ratingsData[newId.toString()] = { comments: [], avgRating: 0 };
  saveRatings();
  showToast('Resep berhasil ditambahkan!', 'success');
  return true;
}

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
    if(showDeleteForOwner && currentUser && (currentUser.role === 'admin' || recipe.userId === currentUser.email) && recipe.userId !== "system") {
      deleteBtn = `<button class="btn-delete delete-recipe-btn" data-id="${recipe.id}"><i class="fas fa-trash"></i> Hapus Resep</button>`;
    }
    return `
      <div class="recipe-card" data-id="${recipe.id}">
        <div class="favorite-star ${favActive}" data-id="${recipe.id}"><i class="${starIcon}"></i></div>
        <img class="card-img" src="${recipe.image}" alt="${recipe.name}" onerror="this.src='${placeholderImage}'">
        <div class="card-content">
          <div class="recipe-title">${recipe.name}<span class="rating-stars">${renderStars(avgRating, true)}</span></div>
          <div class="meta-info"><span>📍 ${recipe.region}</span> • 🕒 ${recipe.time} • 🏷️ ${recipe.category}</div>
          <div class="recipe-desc">${recipe.description.substring(0, 80)}...</div>
          <button class="btn-detail view-detail" data-id="${recipe.id}">Lihat & Komentar</button>
          ${deleteBtn}
        </div>
      </div>
    `;
  }).join('');
}

// VIEWS
let activeCategory = "Daging";
function renderHome() {
  const popularIds = [1,3,2,5,6,8];
  const popular = getAllRecipes().filter(r => popularIds.includes(r.id)).slice(0,6);
  return `<div class="page-header"><h2>Resep Populer</h2></div><div class="recipes-grid">${renderRecipes(popular, true)}</div>`;
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
  if(!currentUser) return `<div class="not-found">Silakan login.</div>`;
  return `<div class="page-header"><h2>Tambah Resep (Upload JPG/PNG)</h2></div>
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
    <div class="profile-stats"><span>Total resep Anda: ${getUserUploadedRecipes().length}</span> <span>Role: ${currentUser.role === 'admin' ? 'Admin' : 'User'}</span></div>
    <h3>Resep yang Anda unggah:</h3>
    <div class="recipes-grid">${renderRecipes(getUserUploadedRecipes(), true)}</div>`;
}
function renderAdminDashboard() {
  if(!currentUser || currentUser.role !== 'admin') return `<div class="not-found">Akses ditolak.</div>`;
  const allRecipes = getAllRecipes();
  let allComments = [];
  for(let rid in ratingsData) {
    const recipe = allRecipes.find(r => r.id == rid);
    ratingsData[rid].comments.forEach((c, idx) => allComments.push({ recipeId: rid, recipeName: recipe?.name || "?", comment: c, idx }));
  }
  return `<div class="page-header"><h2>Dashboard Admin</h2></div>
    <div class="admin-dashboard">
      <div class="admin-section"><h3>Semua Resep</h3><div class="recipes-grid">${renderRecipes(allRecipes, true)}</div></div>
      <div class="admin-section"><h3>Semua Komentar</h3>${allComments.map(c => `
        <div class="comment-item"><strong>${c.comment.name}</strong> ${renderStars(c.comment.rating, false)}<br><small>${c.comment.date}</small><br><strong>Resep:</strong> ${c.recipeName}<br><p>${c.comment.text}</p>
        <button class="btn-delete delete-comment-admin" data-recipe="${c.recipeId}" data-idx="${c.idx}" style="width:auto; padding:4px 12px;">Hapus Komentar</button></div>`).join('')}</div>
    </div>`;
}

// MODAL DETAIL dengan rating opsional komentar
let currentModalRecipe = null;
let selectedRating = 0;

function openModal(recipe) {
  currentModalRecipe = recipe;
  const modal = document.getElementById('recipeModal');
  const avgRating = getRecipeRating(recipe.id);
  const userRating = getUserRating(recipe.id);
  const userCommentText = getUserCommentText(recipe.id);
  
  // Siapkan HTML untuk modal
  let modalHTML = `
    <button class="close-modal" id="closeModalBtn">&times;</button>
    <img class="modal-img" src="${recipe.image}" alt="${recipe.name}" onerror="this.src='${placeholderImage}'">
    <h2 style="color: var(--brown-dark); margin-bottom: 0.5rem;">${recipe.name}</h2>
    <div style="margin-bottom: 0.8rem;">
      <span style="background: var(--green-pale); padding: 0.2rem 0.8rem; border-radius: 20px; font-size: 0.8rem;">🏷️ ${recipe.category}</span>
      <span style="background: var(--green-pale); padding: 0.2rem 0.8rem; border-radius: 20px; font-size: 0.8rem; margin-left: 0.5rem;">📍 ${recipe.region}</span>
    </div>
    <div style="margin-bottom: 0.8rem;">
      <div><strong>Rata-rata:</strong> ${renderStars(avgRating, true)}</div>
      ${userRating ? `<div><strong>Rating Anda:</strong> ${renderStars(userRating, false)} (${userRating}.0/5)</div>` : '<div><em>Anda belum memberi rating</em></div>'}
    </div>
    <h3>Deskripsi:</h3>
    <p style="margin-bottom: 1rem;">${recipe.description}</p>
    <h3>Bahan - bahan:</h3>
    <ul style="margin-bottom: 1rem; margin-left: 1.5rem;">
      ${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}
    </ul>
    <h3>Langkah - langkah:</h3>
    <ol style="margin-bottom: 1rem; margin-left: 1.5rem;">
      ${recipe.steps.map((s, i) => `<li>${s}</li>`).join('')}
    </ol>
  `;
  
  // Bagian komentar dan rating (dengan komentar opsional)
  const comments = getComments(recipe.id);
  let commentsHTML = `<h3>Komentar & Rating Pengguna Lain</h3>`;
  commentsHTML += comments.length ? comments.map((c, idx) => {
    const canDelete = (currentUser && (currentUser.role === 'admin' || c.userId === currentUser.email));
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
        <h3>Berikan Rating & Komentar (komentar opsional)</h3>
        <input type="text" id="commenterName" placeholder="Nama" style="width:100%; margin-bottom:8px;" value="${currentUser.username}">
        <textarea id="commentText" rows="2" placeholder="Komentar (boleh dikosongkan jika hanya ingin memberi rating)" style="width:100%; margin-bottom:8px;">${userCommentText !== "(Tanpa komentar)" ? userCommentText : ""}</textarea>
        <div class="star-rating-input" id="starRatingInputModal">
          <i class="far fa-star" data-rating="1"></i><i class="far fa-star" data-rating="2"></i>
          <i class="far fa-star" data-rating="3"></i><i class="far fa-star" data-rating="4"></i><i class="far fa-star" data-rating="5"></i>
        </div>
        <button id="submitRatingBtn" class="btn-submit" style="margin-top:12px;">Kirim Rating & Komentar</button>
      </div>
    `;
  }
  
  // Gabungkan semua ke dalam modal-content
  const modalContent = document.querySelector('#recipeModal .modal-content');
  modalContent.innerHTML = modalHTML + commentsHTML + `<div id="ratingFormContainer">${ratingFormHTML}</div>`;
  
  // Pasang event listener untuk tombol close
  const closeBtn = document.getElementById('closeModalBtn');
  closeBtn.onclick = () => { modal.style.display = 'none'; document.body.style.overflow = ''; };
  
  // Jika user login, siapkan form rating
  if(currentUser) {
    // Set rating bintang sesuai rating user yang sudah ada (jika ada)
    const stars = document.querySelectorAll('#starRatingInputModal i');
    const existingRating = getUserRating(recipe.id);
    if(existingRating) {
      selectedRating = existingRating;
      stars.forEach(star => {
        const ratingVal = parseInt(star.getAttribute('data-rating'));
        if(ratingVal <= existingRating) {
          star.classList.remove('far'); star.classList.add('fas','selected');
        } else {
          star.classList.remove('fas','selected'); star.classList.add('far');
        }
      });
    } else {
      selectedRating = 0;
      stars.forEach(star => { star.classList.remove('fas','selected'); star.classList.add('far'); });
    }
    
    stars.forEach(star => star.onclick = () => {
      selectedRating = parseInt(star.getAttribute('data-rating'));
      stars.forEach(s => {
        if(parseInt(s.getAttribute('data-rating')) <= selectedRating) {
          s.classList.remove('far'); s.classList.add('fas','selected');
        } else {
          s.classList.remove('fas','selected'); s.classList.add('far');
        }
      });
    });
    
    document.getElementById('submitRatingBtn').onclick = () => {
      if(!currentUser) return showToast('Login dulu', 'error');
      if(selectedRating === 0) return showToast('Pilih rating bintang 1-5', 'error');
      const name = document.getElementById('commenterName').value.trim() || currentUser.username;
      const comment = document.getElementById('commentText').value.trim();
      addOrUpdateComment(recipe.id, name, comment, selectedRating, currentUser.email);
      openModal(recipe); // refresh modal
    };
  }
  
  // Pasang event hapus komentar
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

// EVENT HANDLER
function attachCardEvents() {
  document.querySelectorAll('.favorite-star').forEach(el => { el.removeEventListener('click', favHandler); el.addEventListener('click', favHandler); });
  document.querySelectorAll('.view-detail').forEach(btn => { btn.removeEventListener('click', detailHandler); btn.addEventListener('click', detailHandler); });
  document.querySelectorAll('.delete-recipe-btn').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); deleteRecipeWithConfirm(parseInt(btn.getAttribute('data-id'))); });
  document.querySelectorAll('.delete-comment-admin').forEach(btn => btn.onclick = () => { const rid = parseInt(btn.getAttribute('data-recipe')), idx = parseInt(btn.getAttribute('data-idx')); deleteCommentWithConfirm(rid, idx, currentUser?.email, null); });
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
      let imageBase64 = placeholderImage;
      if(fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if(!file.type.match('image/jpeg') && !file.type.match('image/png')) {
          return showToast('Hanya file JPG atau PNG yang diperbolehkan', 'error');
        }
        imageBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(file);
        });
      }
      addNewRecipe({
        name,
        category: document.getElementById('recipeCategory').value,
        region: document.getElementById('recipeRegion').value.trim() || "Nusantara",
        description: document.getElementById('recipeDesc').value.trim() || "Resep lezat",
        time: document.getElementById('recipeTime').value.trim() || "30 menit",
        difficulty: document.getElementById('recipeDifficulty').value,
        ingredients: document.getElementById('recipeIngredients').value,
        steps: document.getElementById('recipeSteps').value
      }, imageBase64);
      currentView = "profil";
      renderCurrentView();
      highlightNav();
    };
    const fileInput = document.getElementById('recipeImageFile');
    const previewContainer = document.getElementById('imagePreviewContainer');
    const previewImg = document.getElementById('imagePreview');
    fileInput.onchange = (e) => {
      if(fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if(file.type.match('image/jpeg') || file.type.match('image/png')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            previewImg.src = ev.target.result;
            previewContainer.style.display = 'block';
          };
          reader.readAsDataURL(file);
        } else {
          fileInput.value = '';
          previewContainer.style.display = 'none';
          showToast('Hanya file JPG/PNG', 'error');
        }
      } else {
        previewContainer.style.display = 'none';
      }
    };
  }
}

let currentView = "home";
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
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.removeEventListener('click', navClickHandler);
    btn.addEventListener('click', navClickHandler);
  });
}
function navClickHandler(e) {
  const view = e.currentTarget.getAttribute('data-view');
  if((view === 'tambah' || view === 'favorite' || view === 'profil') && !currentUser) {
    showToast('Login dulu untuk mengakses halaman ini', 'error');
    return;
  }
  if(view === 'admin' && (!currentUser || currentUser.role !== 'admin')) {
    showToast('Hanya admin', 'error');
    return;
  }
  currentView = view;
  if(view === 'kategori') activeCategory = "Daging";
  highlightNav();
  renderCurrentView();
}
function highlightNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if(btn.getAttribute('data-view') === currentView) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

// AUTH
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
  const newSubmit = document.getElementById('authSubmitBtn').cloneNode(true);
  document.getElementById('authSubmitBtn').parentNode.replaceChild(newSubmit, document.getElementById('authSubmitBtn'));
  newSubmit.onclick = () => {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    if(registerMode) {
      const username = document.getElementById('authUsername').value.trim();
      if(!username || !email || password.length < 8) { document.getElementById('authError').innerText = "Isi semua, password min 8 karakter"; document.getElementById('authError').style.display = 'block'; return; }
      if(users.find(u => u.email === email)) { document.getElementById('authError').innerText = "Email sudah terdaftar"; document.getElementById('authError').style.display = 'block'; return; }
      users.push({ username, email, password, role: "user" });
      saveUsers();
      alert("Registrasi berhasil! Silakan login.");
      showAuthModal(false);
    } else {
      const user = users.find(u => u.email === email && u.password === password);
      if(!user) { document.getElementById('authError').innerText = "Email atau password salah"; document.getElementById('authError').style.display = 'block'; return; }
      currentUser = user;
      const favKey = `fav_${currentUser.email}`;
      favorites = new Set(JSON.parse(localStorage.getItem(favKey) || "[]"));
      saveSession();
      updateUIAfterAuth();
      closeAuthModal();
      renderCurrentView();
    }
  };
}
function closeAuthModal() { document.getElementById('authModal').style.display = 'none'; }
function updateUIAfterAuth() {
  const g = document.getElementById('userGreeting'), a = document.getElementById('authBtn'), ad = document.getElementById('adminDashboardBtn');
  if(currentUser) { g.innerText = `Halo, ${currentUser.username}`; a.innerText = "Logout"; a.onclick = () => logoutWithConfirm(); ad.style.display = currentUser.role === 'admin' ? 'inline-flex' : 'none'; }
  else { g.innerText = ""; a.innerText = "Login"; a.onclick = () => showAuthModal(false); ad.style.display = 'none'; }
}
function modalInit() {
  const modal = document.getElementById('recipeModal');
  window.onclick = (e) => { if(e.target === modal) { modal.style.display = 'none'; document.body.style.overflow = ''; } };
  document.getElementById('closeAuthModal').onclick = () => closeAuthModal();
  window.addEventListener('click', (e) => { if(e.target === document.getElementById('authModal')) closeAuthModal(); });
}

// INIT
loadAllData();
setupNav();
modalInit();
updateUIAfterAuth();
renderCurrentView();