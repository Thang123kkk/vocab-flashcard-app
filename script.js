import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where ,addDoc,getDoc,setDoc,updateDoc    } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

// COPY LẠI CONFIG CỦA BẠN VÀO ĐÂY
const firebaseConfig = {
    apiKey: "AIzaSyBHkfWeqgcrJ4hoEx8URJI6CkOYDAcZ46Y",
    authDomain: "vocab-app-1f286.firebaseapp.com",
    projectId: "vocab-app-1f286",
    storageBucket: "vocab-app-1f286.firebasestorage.app",
    messagingSenderId: "664950638272",
    appId: "1:664950638272:web:6fc13d3b4544dc147fcf25"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
const avatarBtn = document.getElementById('nav-avatar');
const grid = document.getElementById('learning-sets-grid');

// XÁC ĐỊNH XEM TRÌNH DUYỆT ĐANG MỞ FILE NÀO
const currentPage = document.body.getAttribute('data-page');

// ============ ERROR HANDLING & VALIDATION ========
function showToast(message, type = 'success', duration = 3000) {
    const toast = document.createElement('div');
    const colors = {
        success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
    };

    toast.style.cssText = `
        position: fixed;
        right: 20px;
        bottom: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 14px 20px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.18);
        z-index: 9999;
        font-weight: 600;
        max-width: 360px;
        animation: toastIn 0.25s ease;
    `;

    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 260);
    }, duration);
}

function showSuccess(message) { showToast(message, 'success'); }
function showError(message) { showToast(message, 'error'); }

const toastStyle = document.createElement('style');
toastStyle.textContent = `
    @keyframes toastIn {
        from { opacity: 0; transform: translateX(30px); }
        to { opacity: 1; transform: translateX(0); }
    }
`;
document.head.appendChild(toastStyle);

// Đóng nhanh các hộp thoại bằng backdrop hoặc Escape để thao tác nhất quán trên mọi trang.
document.querySelectorAll('.modal-overlay').forEach((modal) => {
    modal.addEventListener('click', (event) => {
        if (event.target === modal) modal.style.display = 'none';
    });
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.modal-overlay').forEach((modal) => {
        if (modal.style.display !== 'none') modal.style.display = 'none';
    });
});

function handleFirebaseError(error) {
    const errorMap = {
        'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ đăng nhập.',
        'auth/popup-blocked': 'Cửa sổ đăng nhập bị chặn. Hãy cho phép popup và thử lại.',
        'auth/cancelled-popup-request': 'Yêu cầu đăng nhập đã bị hủy.',
        'permission-denied': 'Bạn không có quyền truy cập dữ liệu này.',
        'not-found': 'Dữ liệu không tồn tại.',
        'unavailable': 'Dịch vụ tạm thời không khả dụng.'
    };

    const message = errorMap[error.code] || error.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
    showError(message);
    console.error('Firebase error:', error);
}

function validateSetForm() {
    const titleInput = document.getElementById('set-title');
    const title = titleInput ? titleInput.value.trim() : '';
    const cardEls = document.querySelectorAll('.vocab-input-card');

    if (!title) {
        showError('Vui lòng nhập tiêu đề bộ thẻ.');
        return false;
    }

    if (cardEls.length === 0) {
        showError('Vui lòng thêm ít nhất một từ vựng.');
        return false;
    }

    for (const card of cardEls) {
        const term = card.querySelector('.input-term')?.value.trim();
        const def = card.querySelector('.input-def')?.value.trim();

        if (!term || !def) {
            showError('Mỗi từ vựng cần có từ và định nghĩa.');
            return false;
        }
    }

    return true;
}

// ============ WORDS STUDIED TODAY TRACKING ============
function getTodayWordsCount(userId) {
    try {
        const today = new Date().toDateString();
        const key = `words_today_${userId}_${today}`;
        return JSON.parse(localStorage.getItem(key) || '{"count":0,"max":10}');
    } catch {
        return { count: 0, max: 10 };
    }
}

function recordWordStudied(userId) {
    const today = new Date().toDateString();
    const key = `words_today_${userId}_${today}`;
    const data = getTodayWordsCount(userId);
    
    if (data.count < data.max) {
        data.count += 1;
        localStorage.setItem(key, JSON.stringify(data));
        updateTodayWordsDisplay(userId);
    }
}

function updateTodayWordsDisplay(userId) {
    const counter = document.getElementById('today-words-count');
    if (!counter) return;
    
    const data = getTodayWordsCount(userId);
    counter.textContent = `${data.count}/${data.max}`;
}



// ============ RESPONSIVE: HAMBURGER MENU ============
const hamburgerBtn = document.getElementById('hamburger-toggle');
const sidebar = document.querySelector('.sidebar-left');

if (hamburgerBtn && sidebar) {
    hamburgerBtn.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        document.body.classList.toggle('sidebar-open');
    });

    // Close sidebar when clicking on nav links
    document.querySelectorAll('.nav-btn').forEach(link => {
        link.addEventListener('click', () => {
            sidebar.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        });
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !hamburgerBtn.contains(e.target)) {
            sidebar.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        }
    });
} 

// 1. XỬ LÝ ĐĂNG NHẬP / ĐĂNG XUẤT (Bản an toàn)
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        
        // KIỂM TRA BẢO VỆ: Có nút avatar thì mới đổi hình
        if (avatarBtn) {
            avatarBtn.innerHTML = `<img src="${user.photoURL}" style="width:100%; height:100%; border-radius:50%;" alt="User">`;
            avatarBtn.title = `Đăng xuất khỏi ${user.displayName}`;
        }
        
        // Gọi hàm tải dữ liệu lưới nếu đang ở 2 trang này
        if (currentPage === 'home' || currentPage === 'created') {
            loadSets(currentPage); 
        }
        // TÍNH NĂNG MỚI BỔ SUNG: Cập nhật biến đếm từ ở trang chủ
        if (currentPage === 'home') {
            updateTodayWordsDisplay(user.uid);
            renderForecastChart(user.uid); // KÍCH HOẠT BIỂU ĐỒ 7 NGÀY TẠI ĐÂY
        }
    } else {
        currentUser = null;
        if (avatarBtn) avatarBtn.innerHTML = `<i class="fa-solid fa-user"></i>`;
        if (grid) {
            const emptyHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <i class="fa-solid fa-lock"></i>
                    <h3>Vui lòng đăng nhập</h3>
                    <p>Đăng nhập để xem và tạo bộ thẻ học từ vựng</p>
                </div>
            `;
            grid.innerHTML = emptyHTML;
        }
    }
});

// KIỂM TRA BẢO VỆ: Có nút avatar thì mới gắn sự kiện click
if (avatarBtn) {
    avatarBtn.addEventListener('click', () => {
        if (!currentUser) signInWithPopup(auth, provider);
        else if(confirm("Đăng xuất?")) signOut(auth);
    });
}

// ==========================================
// LOGIC RESET DỮ LIỆU (TRANG CHỦ)
// ==========================================
if (currentPage === 'home') {
    const btnSettings = document.getElementById('btn-open-settings');
    const settingsModal = document.getElementById('settings-modal');
    
    if (btnSettings && settingsModal) {
        btnSettings.addEventListener('click', () => settingsModal.style.display = 'flex');
        document.getElementById('btn-close-settings').addEventListener('click', () => settingsModal.style.display = 'none');

        // 1. Nút: Reset toàn bộ tiến độ (Chỉ xóa file user_progress)
        document.getElementById('btn-reset-all-srs').addEventListener('click', async () => {
            if (!currentUser) return;
            if (!confirm("CẢNH BÁO: Hành động này sẽ xóa sạch dữ liệu Ôn tập ngắt quãng (SRS) và các thẻ Đã thuộc của TẤT CẢ bộ thẻ. Bạn có chắc không?")) return;
            
            try {
                // Quét tìm tất cả tiến độ của user này
                const q = query(collection(db, "user_progress"), where("userId", "==", currentUser.uid));
                const snapshot = await getDocs(q);
                
                // Chạy lệnh xóa hàng loạt
                const deletePromises = [];
                snapshot.forEach(d => deletePromises.push(deleteDoc(d.ref)));
                await Promise.all(deletePromises);
                
                alert("Đã reset toàn bộ tiến độ học!");
                window.location.reload();
            } catch(e) { console.error(e); }
        });

        // 2. Nút: Xóa toàn bộ Account (Xóa tiến độ + Xóa luôn các bộ thẻ đã tạo)
        document.getElementById('btn-reset-account').addEventListener('click', async () => {
            if (!currentUser) return;
            if (!confirm("CẢNH BÁO NGUY HIỂM: Xóa toàn bộ tiến độ học VÀ TẤT CẢ BỘ THẺ do bạn tạo. Dữ liệu sẽ bốc hơi vĩnh viễn! Xác nhận xóa?")) return;
            
            try {
                // Xóa tiến độ
                const pQ = query(collection(db, "user_progress"), where("userId", "==", currentUser.uid));
                const pSnap = await getDocs(pQ);
                const pPromises = [];
                pSnap.forEach(d => pPromises.push(deleteDoc(d.ref)));
                await Promise.all(pPromises);

                // Xóa các bộ thẻ
                const sQ = query(collection(db, "study_sets"), where("ownerId", "==", currentUser.uid));
                const sSnap = await getDocs(sQ);
                const sPromises = [];
                sSnap.forEach(d => sPromises.push(deleteDoc(d.ref)));
                await Promise.all(sPromises);

                alert("Đã xóa sạch dữ liệu tài khoản!");
                window.location.reload();
            } catch(e) { console.error(e); }
        });
    }
}

// 2. TẢI VÀ VẼ LƯỚI
async function loadSets(pageType) {
    if (!currentUser || !grid) return;
    grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><i class="fa-solid fa-spinner fa-spin"></i><p>Đang tải bộ thẻ...</p></div>';

    try {
        let q;
        if (pageType === 'home') {
            q = query(collection(db, "study_sets"), where("isPublic", "==", true));
        } else if (pageType === 'created') {
            q = query(collection(db, "study_sets"), where("ownerId", "==", currentUser.uid));
        }

        const querySnapshot = await getDocs(q);
        grid.innerHTML = '';

        if (querySnapshot.empty) {
            const emptyHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <i class="fa-regular fa-folder-open"></i>
                    <h3>Chưa có bộ thẻ nào</h3>
                    <p>Bắt đầu bằng cách tạo bộ thẻ đầu tiên của bạn để học từ vựng</p>
                    <a href="create.html" class="btn btn-black" style="text-decoration: none; display: inline-block; margin-top: 15px;">
                        <i class="fa-solid fa-plus"></i> Tạo Bộ thẻ
                    </a>
                </div>
            `;
            grid.innerHTML = emptyHTML;
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const isMine = (data.ownerId === currentUser.uid);

            const card = document.createElement('div');
            card.className = 'study-set-card';
            
            const statusIcon = data.isPublic 
                ? `<span style="color: #2196F3;"><i class="fa-solid fa-earth-americas"></i> Công khai</span>` 
                : `<span style="color: #4CAF50;"><i class="fa-solid fa-lock"></i> Riêng tư</span>`;

            card.innerHTML = `
                <h4 class="set-title">${data.title}</h4>
                <p class="set-lang"><i class="fa-solid fa-book-open"></i> ${data.description || 'Không có mô tả'}</p>
                
                <div class="progress-container">
                    <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: 0%;"></div></div>
                    <span class="progress-text">0 từ</span>
                </div>
                
                <div class="set-footer">
                    <span class="word-count">${statusIcon}</span>
                    <span class="author-tag"><i class="fa-regular fa-user"></i> ${data.authorName} ${isMine ? '(Bạn)' : ''}</span>
                </div>
            `;

            // Chức năng: Khi click vào thẻ, chuyển sang trang học và truyền ID bộ thẻ lên URL
            card.addEventListener('click', () => {
                window.location.href = `study.html?id=${docSnap.id}`;
            });

            if (isMine && pageType === 'created') {
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                deleteBtn.style = "position: absolute; right: 15px; top: 15px; background: none; border: none; color: #ff5252; cursor: pointer;";
                card.style.position = 'relative'; 
                card.appendChild(deleteBtn);

                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation(); 
                    if (confirm(`Xóa bộ thẻ "${data.title}"?`)) {
                        await deleteDoc(doc(db, "study_sets", docSnap.id));
                        loadSets(currentPage);
                    }
                });
            }
            grid.appendChild(card);
        });
    } catch (error) {
        console.error("Lỗi:", error);
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><i class="fa-solid fa-triangle-exclamation"></i><h3>Chưa thể tải bộ thẻ</h3><p>Vui lòng kiểm tra kết nối và thử lại.</p></div>';
    }
}
// 3. VẼ BIỂU ĐỒ DỰ BÁO 7 NGÀY (Ở TRANG CHỦ)
async function renderForecastChart(userId) {
    const barsContainer = document.getElementById('forecast-bars');
    const dueTodaySpan = document.getElementById('due-today-count');
    const masteredSpan = document.getElementById('mastered-count');
    if (!barsContainer) return;

    try {
        const q = query(collection(db, "user_progress"), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);

        let dueToday = 0;
        let mastered = 0;
        
        // Mảng chứa số lượng từ của 7 ngày (0 = hôm nay, 1 = ngày mai...)
        const forecastCounts = [0, 0, 0, 0, 0, 0, 0];
        
        // Lấy thời điểm 00:00:00 của ngày hôm nay làm mốc
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Tạo mốc thời gian cho 8 ngày (để làm khoảng chặn tính toán)
        const daysMilestones = [];
        for (let i = 0; i < 8; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            daysMilestones.push(d.getTime());
        }

        querySnapshot.forEach(docSnap => {
            const data = docSnap.data().learnedCards || {};
            for (const key in data) {
                const card = data[key];
                if (card.status === 'learned') {
                    mastered++; // Đếm từ thuần thục
                } else if (card.status === 'reviewing') {
                    const reviewTime = card.nextReview;
                    
                    // Thẻ quá hạn hoặc đến hạn hôm nay
                    if (reviewTime < daysMilestones[1]) {
                        dueToday++;
                        forecastCounts[0]++;
                    } else {
                        // Phân bổ vào 6 ngày tiếp theo
                        for (let i = 1; i < 7; i++) {
                            if (reviewTime >= daysMilestones[i] && reviewTime < daysMilestones[i+1]) {
                                forecastCounts[i]++;
                                break;
                            }
                        }
                    }
                }
            }
        });

        // Cập nhật text thống kê
        if (dueTodaySpan) dueTodaySpan.textContent = dueToday;
        if (masteredSpan) masteredSpan.textContent = mastered;

        // Vẽ biểu đồ
        const maxCount = Math.max(...forecastCounts, 1); // Tìm cột cao nhất để scale tỷ lệ
        const maxBarHeight = 40; // Chiều cao tối đa của cột (px)
        const dayNames = ["CN", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7"];
        
        barsContainer.innerHTML = '';
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            const dayLabel = dayNames[d.getDay()]; // Tự động lấy đúng thứ trong tuần
            
            const count = forecastCounts[i];
            const height = (count / maxCount) * maxBarHeight; // Chiều cao tương đối
            
            const isActive = (i === 0) ? 'active' : '';
            const isTodayClass = (i === 0) ? 'today' : '';
            const countText = count > 0 ? count : '';
            
            barsContainer.innerHTML += `
                <div class="bar-col ${isTodayClass}">
                    <div class="bar-count">${countText}</div>
                    <div class="bar ${isActive}" style="height: ${height > 0 ? height : 2}px;"></div>
                    <span class="day-label">${dayLabel}</span>
                </div>
            `;
        }
    } catch (error) {
        console.error("Lỗi vẽ biểu đồ:", error);
    }
}


    // ==========================================
// 5. LOGIC RIÊNG CHO TRANG TẠO / SỬA (create.html)
// ==========================================
if (currentPage === 'create') {
    const vocabContainer = document.getElementById('vocab-cards-container');
    const btnAddCard = document.getElementById('btn-add-card');
    const btnSaveSet = document.getElementById('btn-save-set');
    const pageTitle = document.getElementById('page-title');
    
    // Đọc URL xem có ID bộ thẻ không (Nếu có là chế độ Sửa)
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('id');

    // Hàm tạo ra 1 khối HTML nhập liệu cho 1 từ vựng
    function addVocabRow(term = '', def = '', pron = '', type = '', ex = '', syn = '') {
        // Đếm lại số lượng thẻ hiện tại để đánh số thứ tự chính xác (1, 2, 3...)
        const currentCount = vocabContainer.querySelectorAll('.vocab-input-card').length + 1;

        const card = document.createElement('div');
        card.className = 'vocab-input-card';
        card.innerHTML = `
            <div class="card-number">${currentCount}</div>
            <div class="card-fields">
                <div class="field-grid">
                    <div class="field-group">
                        <label>Thuật ngữ</label>
                        <input type="text" class="field-input input-term" placeholder="VD: Hello" value="${term}">
                    </div>
                    <div class="field-group">
                        <label>Định nghĩa</label>
                        <input type="text" class="field-input input-def" placeholder="VD: Xin chào" value="${def}">
                    </div>
                </div>
                <div class="field-grid">
                    <div class="field-group">
                        <label>Phát âm</label>
                        <input type="text" class="field-input input-pron" value="${pron}">
                    </div>
                    <div class="field-group">
                        <label>Loại từ</label>
                        <input type="text" class="field-input input-type" value="${type}">
                    </div>
                </div>
                <div class="field-grid">
                    <div class="field-group">
                        <label>Ví dụ</label>
                        <input type="text" class="field-input input-ex" value="${ex}">
                    </div>
                    <div class="field-group">
                        <label>Từ đồng nghĩa</label>
                        <input type="text" class="field-input input-syn" value="${syn}">
                    </div>
                </div>
            </div>
            <button class="btn-delete-card" type="button"><i class="fa-solid fa-trash-can"></i></button>
        `;

        // Chức năng xóa thẻ và tự động cập nhật lại số thứ tự hàng loạt
        card.querySelector('.btn-delete-card').addEventListener('click', () => {
            card.remove();
            updateCardNumbers();
        });

        vocabContainer.appendChild(card);
    }

    // Hàm sắp xếp lại số thứ tự (1, 2, 3...) sau khi có thẻ bị xóa
    function updateCardNumbers() {
        const cards = vocabContainer.querySelectorAll('.vocab-input-card');
        cards.forEach((card, index) => {
            card.querySelector('.card-number').textContent = index + 1;
        });
    }

    // --- LOGIC NHẬP DỮ LIỆU HÀNG LOẠT (BULK IMPORT) ---
    const importModal = document.getElementById('import-modal');
    document.getElementById('btn-open-import').addEventListener('click', () => importModal.style.display = 'flex');
    const closeImport = () => importModal.style.display = 'none';
    document.getElementById('btn-close-import').addEventListener('click', closeImport);
    document.getElementById('btn-cancel-import').addEventListener('click', closeImport);

    document.getElementById('btn-process-import').addEventListener('click', () => {
        const text = document.getElementById('import-textarea').value;
        if (!text.trim()) return;

        const termSepVal = document.querySelector('input[name="term-sep"]:checked').value;
        const cardSepVal = document.querySelector('input[name="card-sep"]:checked').value;

        const cardSep = cardSepVal === 'newline' ? '\n' : ';';
        const termSep = termSepVal === 'tab' ? '\t' : ',';

        const rawCards = text.split(cardSep);
        
        rawCards.forEach(row => {
            if (!row.trim()) return;
            const parts = row.split(termSep);
            const t = parts[0]?.trim() || '';
            const d = parts[1]?.trim() || '';
            const p = parts[2]?.trim() || '';
            const ty = parts[3]?.trim() || '';
            const e = parts[4]?.trim() || '';
            const s = parts[5]?.trim() || '';

            if (t) addVocabRow(t, d, p, ty, e, s);
        });

        closeImport();
        document.getElementById('import-textarea').value = '';
    });

    // Bắt sự kiện bấm nút "Thêm thẻ" thủ công ở cuối trang
    btnAddCard.addEventListener('click', () => addVocabRow());

    // --- KHỞI TẠO DỮ LIỆU KHI VÀO TRANG (CHỐNG DUPLICATE) ---
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;

        // Xóa sạch container trước khi render để tránh bị chồng lấn dữ liệu cũ
        vocabContainer.innerHTML = '';

        if (editId) {
            // CHẾ ĐỘ SỬA: Lấy dữ liệu cũ từ Firebase đổ vào
            pageTitle.textContent = "Chỉnh sửa bộ thẻ";
            btnSaveSet.textContent = "Hoàn tất";
            
            try {
                const docRef = doc(db, "study_sets", editId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    document.getElementById('set-title').value = data.title;
                    document.getElementById('set-desc').value = data.description || '';
                    document.getElementById('set-public').checked = data.isPublic;
                    
                    // Duyệt mảng và vẽ chính xác từng thẻ
                    data.words.forEach(w => addVocabRow(w.term, w.definition, w.pronunciation, w.type, w.example, w.synonyms));
                }
            } catch (error) { console.error(error); }
        } else {
            // CHẾ ĐỘ TẠO MỚI: Chỉ mồi sẵn đúng 3 thẻ trống duy nhất
            for(let i = 0; i < 3; i++) {
                addVocabRow();
            }
        }
    });

    // --- LƯU LÊN FIREBASE (CREATE / UPDATE) ---
    btnSaveSet.addEventListener('click', async () => {
        if (!currentUser) {
            showError('Vui lòng đăng nhập trước khi tạo bộ thẻ.');
            return;
        }

        if (!validateSetForm()) {
            return;
        }

        const title = document.getElementById('set-title').value.trim();

        const wordsArray = [];
        document.querySelectorAll('.vocab-input-card').forEach(card => {
            const term = card.querySelector('.input-term').value.trim();
            const def = card.querySelector('.input-def').value.trim();
            if (term && def) { 
                wordsArray.push({
                    term: term, definition: def,
                    pronunciation: card.querySelector('.input-pron').value.trim(),
                    type: card.querySelector('.input-type').value.trim(),
                    example: card.querySelector('.input-ex').value.trim(),
                    synonyms: card.querySelector('.input-syn').value.trim()
                });
            }
        });

        if (wordsArray.length === 0) return alert("Cần ít nhất 1 từ vựng hợp lệ!");
        btnSaveSet.textContent = "Đang lưu...";

        const setData = {
            title: title,
            description: document.getElementById('set-desc').value.trim(),
            isPublic: document.getElementById('set-public').checked,
            words: wordsArray
        };

        try {
            if (editId) {
                await updateDoc(doc(db, "study_sets", editId), setData);
                showSuccess('Cập nhật bộ thẻ thành công!');
                setTimeout(() => window.location.href = `study.html?id=${editId}`, 500);
            } else {
                setData.ownerId = currentUser.uid;
                setData.authorName = currentUser.displayName;
                setData.timestamp = new Date();
                await addDoc(collection(db, "study_sets"), setData);
                showSuccess('Tạo bộ thẻ thành công!');
                setTimeout(() => window.location.href = 'created.html', 800);
            }
        } catch (error) {
            console.error("Lỗi:", error);
            handleFirebaseError(error);
            btnSaveSet.textContent = editId ? "Hoàn tất" : "Tạo";
        }
    });

    // ==========================================
    // 🪄 PHÉP THUẬT AI: TỰ ĐỘNG ĐIỀN TỪ VỰNG (BẢN NÂNG CẤP)
    // ==========================================
    
    vocabContainer.addEventListener('focusout', async (event) => {
        if (event.target.classList.contains('input-term')) {
            const word = event.target.value.trim();
            if (!word) return;

            const card = event.target.closest('.vocab-input-card');
            const defInput = card.querySelector('.input-def');
            
            // Nếu đã gõ nghĩa rồi thì không ghi đè
            if (defInput.value) return;

            // Đổi màu cam báo hiệu đang xử lý
            event.target.style.color = '#ff9800'; 

            let phonetic = '', partOfSpeech = '', example = '', synonyms = '', definitionVi = '';

            // 1. GỌI API TỪ ĐIỂN (Bắt lỗi riêng biệt)
            try {
                const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
                if (dictRes.ok) {
                    const dictData = await dictRes.json();
                    const result = dictData[0];
                    
                    // Dùng dấu chấm hỏi (?.) để JS không bị crash nếu dữ liệu bị khuyết
                    phonetic = result.phonetic || result.phonetics?.find(p => p.text)?.text || '';
                    
                    const meaning = result.meanings?.[0];
                    if (meaning) {
                        partOfSpeech = meaning.partOfSpeech || '';
                        example = meaning.definitions?.[0]?.example || '';
                        synonyms = meaning.synonyms?.slice(0, 3).join(', ') || '';
                    }
                }
            } catch (err) {
                console.warn("Từ điển API không lấy được cấu trúc:", err);
            }

            // 2. GỌI API GOOGLE DỊCH (Chuẩn xác, không giới hạn)
            try {
                // Sử dụng endpoint dịch tự do của Google
                const transRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(word)}`);
                if (transRes.ok) {
                    const transData = await transRes.json();
                    definitionVi = transData[0][0][0] || '';
                }
            } catch (err) {
                console.warn("Lỗi Google Translate API:", err);
            }

            // 3. KIỂM TRA VÀ ĐỔ DỮ LIỆU
            if (!definitionVi && !phonetic) {
                event.target.style.color = '#ff5252'; // Đỏ: Thất bại hoàn toàn
                return;
            }

            card.querySelector('.input-def').value = definitionVi;
            card.querySelector('.input-pron').value = phonetic;
            card.querySelector('.input-type').value = partOfSpeech;
            card.querySelector('.input-ex').value = example;
            card.querySelector('.input-syn').value = synonyms;

            // Xanh lá: Xong!
            event.target.style.color = '#4CAF50'; 
        }
    });
    // Code cho nút màu đen (Yêu cầu AI tạo từ vựng hàng loạt)
    const btnAiMagic = document.querySelector('.ai-magic-btn');
    if(btnAiMagic) {
        btnAiMagic.addEventListener('click', () => {
            alert("Tính năng điền hàng loạt bằng Gemini API đang được phát triển.\nHiện tại, hãy gõ từ tiếng Anh vào ô Thuật Ngữ và click ra ngoài để xem phép thuật nhé!");
        });
    }

}

// ==========================================
// 6. LOGIC TRANG HỌC FLASHCARD (study.html)
// ==========================================

// ==========================================
    // LOGIC BẢNG CÀI ĐẶT QUIZ (An toàn tuyệt đối)
    // ==========================================
    const quizModal = document.getElementById('quiz-setup-modal');
    const btnOpenQuiz = document.getElementById('btn-open-quiz-setup');

    if (btnOpenQuiz && quizModal) {
        // Mở popup không cần check mảng (vì trang quiz.html sẽ tự check)
        btnOpenQuiz.addEventListener('click', () => {
            quizModal.style.display = 'flex';
        });

        document.getElementById('btn-close-quiz')?.addEventListener('click', () => {
            quizModal.style.display = 'none';
        });
        
        document.getElementById('btn-start-quiz')?.addEventListener('click', () => {
            // Tự lấy ID từ URL hiện tại luôn cho an toàn
            const currentUrlParams = new URLSearchParams(window.location.search);
            const currentSetId = currentUrlParams.get('id');
            
            const filter = document.getElementById('quiz-filter').value;
            const mode = document.getElementById('quiz-mode').value;
            const limit = document.getElementById('quiz-limit').value;
            
            // Chuyển hướng sang trang quiz.html
            window.location.href = `quiz.html?id=${currentSetId}&filter=${filter}&mode=${mode}&limit=${limit}`;
        });
    }
if (currentPage === 'study') {
    const urlParams = new URLSearchParams(window.location.search);
    const setId = urlParams.get('id');

    let wordsArray = [];
    let currentIndex = 0;
    let studyProgress = {}; // Bây giờ sẽ lưu dạng Object SM-2 thay vì boolean

    const flashcard = document.getElementById('flashcard');
    const wordListContainer = document.getElementById('word-list-container');

    function speakWord(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
    }

    document.getElementById('btn-play-audio').addEventListener('click', (e) => {
        e.stopPropagation(); 
        speakWord(wordsArray[currentIndex].term);
    });

    flashcard.addEventListener('click', () => {
        flashcard.classList.toggle('is-flipped');
    });

    function updateUI() {
        if (wordsArray.length === 0) return;
        const currentWord = wordsArray[currentIndex];

        flashcard.classList.remove('is-flipped');

        // MẶT TRƯỚC: Chỉ hiện duy nhất từ vựng để tăng độ khó và tập trung
        document.getElementById('fc-front-word').textContent = currentWord.term;
        document.getElementById('fc-front-pron').textContent = ''; // Xóa sạch mọi gợi ý
        
        // MẶT SAU: Gộp Loại từ, Phát âm hiển thị nhỏ ở trên Định nghĩa
        const typePron = `${currentWord.type ? currentWord.type + ' - ' : ''} ${currentWord.pronunciation || ''}`.trim();
        
        // Render HTML kết hợp rất đẹp mắt
        document.getElementById('fc-back-def').innerHTML = 
            (typePron ? `<span style="font-size: 16px; color: #777; font-weight: normal; display: block; margin-bottom: 8px;">${typePron}</span>` : '') + 
            currentWord.definition;
        
        const synElement = document.getElementById('fc-back-syn');
        if (currentWord.synonyms) {
            synElement.textContent = currentWord.synonyms.replace(/,/g, ';'); 
            synElement.style.display = 'block'; 
        } else {
            synElement.style.display = 'none'; 
        }

        const exElement = document.getElementById('fc-back-ex');
        if (currentWord.example) {
            exElement.textContent = currentWord.example;
            exElement.style.display = 'block'; 
        } else {
            exElement.style.display = 'none'; 
        }

        document.getElementById('fc-counter').textContent = `Thẻ ${currentIndex + 1} / ${wordsArray.length}`;
        renderList();
    }

    // --- CẬP NHẬT: VẼ LẠI DANH SÁCH BÊN DƯỚI THEO TRẠNG THÁI MỚI ---
    function renderList() {
        wordListContainer.innerHTML = '';
        wordsArray.forEach((word, index) => {
            const progressData = studyProgress[index] || {};
            const isLearned = progressData.status === 'learned';
            const isReviewing = progressData.status === 'reviewing';
            
            // Cài đặt icon tùy theo trạng thái
            let iconHTML = '<i class="fa-solid fa-circle-minus" style="color:#e0e0e0; font-size:20px;" title="Chưa học"></i>';
            let rowClass = 'word-list-item';

            if (isLearned) {
                iconHTML = '<i class="fa-solid fa-check-circle" style="color:#4caf50; font-size:20px;" title="Đã thuộc (Bỏ qua)"></i>';
                rowClass += ' learned';
            } else if (isReviewing) {
                iconHTML = '<i class="fa-solid fa-clock-rotate-left" style="color:#fbbc05; font-size:20px;" title="Đang trong hàng đợi SRS"></i>';
                rowClass += ' reviewing'; // Có thể thêm CSS viền vàng sau này nếu muốn
            }
            
            const row = document.createElement('div');
            row.className = rowClass;
            row.innerHTML = `
                <div>
                    <h4 style="font-size:18px;">${word.term} <span style="font-size:12px; color:#777; font-weight:normal;">${word.pronunciation}</span></h4>
                    <p style="color:#555; font-size:14px; margin-top:5px;">${word.type ? word.type + ' - ' : ''} ${word.definition}</p>
                </div>
                <div>${iconHTML}</div>
            `;
            wordListContainer.appendChild(row);
        });
    }

    async function saveProgress() {
        if (!currentUser || !setId) return;
        const progressRef = doc(db, "user_progress", `${currentUser.uid}_${setId}`);
        try {
            // Thêm userId và setId vào trong tài liệu để dễ dàng truy vấn gom bài sau này
            await setDoc(progressRef, { 
                userId: currentUser.uid, 
                setId: setId,
                learnedCards: studyProgress 
            }, { merge: true });
        } catch (error) {
            console.error("Lỗi lưu tiến độ:", error);
        }
    }

    async function loadStudyData() {
        if (!setId) return alert("Không tìm thấy ID bộ thẻ!");
        try {
            const docRef = doc(db, "study_sets", setId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                document.getElementById('study-set-title').textContent = data.title;
                wordsArray = data.words || [];

                if (currentUser) {
                    const progressRef = doc(db, "user_progress", `${currentUser.uid}_${setId}`);
                    const progressSnap = await getDoc(progressRef);
                    if (progressSnap.exists()) {
                        // Nạp dữ liệu cấu trúc mới vào
                        studyProgress = progressSnap.data().learnedCards || {};
                    }
                    // Hiện nút Reset và gắn sự kiện
                    const btnReset = document.getElementById('btn-reset-progress');
                    if (btnReset) {
                        btnReset.style.display = 'inline-block';
                        btnReset.addEventListener('click', async () => {
                            if (confirm("Hành động này sẽ xóa trạng thái Đã thuộc và lịch sử Lặp lại ngắt quãng của bộ thẻ này. Bạn muốn học lại từ đầu?")) {
                                try {
                                    await deleteDoc(progressRef); // Xóa thẳng file tiến độ trên Firebase
                                    alert("Đã reset thành công!");
                                    window.location.reload(); // Tải lại trang
                                } catch (error) { console.error(error); }
                            }
                        });
                    }


                    if (data.ownerId === currentUser.uid) {
                        const btnEdit = document.getElementById('btn-edit-set');
                        btnEdit.style.display = 'inline-block';
                        btnEdit.href = `create.html?id=${setId}`; 
                    }
                }

                updateUI();
            } else {
                alert("Bộ thẻ không tồn tại hoặc đã bị xóa.");
            }
        } catch (error) {
            console.error("Lỗi:", error);
        }
    }

    document.getElementById('btn-next').addEventListener('click', () => {
        if (currentIndex < wordsArray.length - 1) { currentIndex++; updateUI(); }
    });
    document.getElementById('btn-prev').addEventListener('click', () => {
        if (currentIndex > 0) { currentIndex--; updateUI(); }
    });

    // --- CẬP NHẬT: LOGIC PHÂN LOẠI SM-2 KHI BẤM NÚT ---
    document.getElementById('btn-fail').addEventListener('click', () => {
        
        // Lấy chính xác thời gian hiện tại để thẻ đáo hạn ngay lập tức
        let nextDate = new Date(); 
        
        studyProgress[currentIndex] = {
            status: 'reviewing',
            repetition: 0,
            interval: 0, // Sửa interval thành 0
            easeFactor: 2.5,
            nextReview: nextDate.getTime() // Lưu mốc thời gian ngay lúc này
        }; 

        saveProgress();
        if(typeof recordWordStudied === 'function') recordWordStudied(currentUser.uid);
        
        if (currentIndex < wordsArray.length - 1) { currentIndex++; updateUI(); } else { renderList(); }
    });
    
    document.getElementById('btn-pass').addEventListener('click', () => {
        // Nút "Đã thuộc" -> Đóng gói cất đi, không đưa vào SRS
        studyProgress[currentIndex] = {
            status: 'learned'
        }; 

        saveProgress();
        if(typeof recordWordStudied === 'function') recordWordStudied(currentUser.uid);
        
        if (currentIndex < wordsArray.length - 1) { currentIndex++; updateUI(); } else { renderList(); }
    });

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); flashcard.classList.toggle('is-flipped'); }
        if (e.code === 'ArrowRight') document.getElementById('btn-next').click();
        if (e.code === 'ArrowLeft') document.getElementById('btn-prev').click();
        if (e.key === '1') document.getElementById('btn-fail').click();
        if (e.key === '2') document.getElementById('btn-pass').click();
    });

    onAuthStateChanged(auth, (user) => {
        if (user) { loadStudyData(); } 
        else { alert("Vui lòng đăng nhập để học!"); window.location.href="index.html"; }
    });
}   




// ==========================================
// 7. LOGIC TRANG LẶP LẠI NGẮT QUÃNG (repetition.html)
// ==========================================
if (currentPage === 'repetition') {
    let dueCards = []; // Mảng 1: Chỉ chứa thẻ cần học NGAY LÚC NÀY
    let allUpcomingCards = []; // Mảng 2: Chứa TẤT CẢ thẻ trong SRS để vẽ danh sách
    let currentCardIndex = 0;

    const flashcard = document.getElementById('flashcard');
    const srsControls = document.getElementById('srs-controls-panel');
    const counterDisplay = document.getElementById('srs-total-count');
    const srsListContainer = document.getElementById('srs-word-list-container'); 

    // Hàm gọi loa
    document.getElementById('btn-play-audio').addEventListener('click', (e) => {
        e.stopPropagation(); 
        if(dueCards.length > 0 && currentCardIndex < dueCards.length) {
            const utterance = new SpeechSynthesisUtterance(dueCards[currentCardIndex].wordData.term);
            utterance.lang = 'en-US';
            window.speechSynthesis.speak(utterance);
        }
    });

    flashcard.addEventListener('click', () => {
        if(dueCards.length > 0 && currentCardIndex < dueCards.length) {
            flashcard.classList.toggle('is-flipped');
            if(flashcard.classList.contains('is-flipped')) {
                srsControls.style.display = 'flex';
            }
        }
    });


    // 1. THUẬT TOÁN SM-2 TÙY CHỈNH (Hiện đại hơn)
    function calculateSM2(quality, progressData) {
        let { repetition = 0, interval = 0, easeFactor = 2.5 } = progressData;

        if (quality >= 3) {
            // Nhớ bài
            if (repetition === 0) {
                // CẢI TIẾN: Lần đầu tiên đánh giá thẻ sẽ giãn ngày ngay lập tức
                if (quality === 3) interval = 1;      // Khó: 1 ngày
                else if (quality === 4) interval = 2; // Tốt: 2 ngày
                else if (quality === 5) interval = 4; // Dễ: 4 ngày
            } else if (repetition === 1) {
                interval = 6;
            } else {
                interval = Math.round(interval * easeFactor);
            }
            repetition++;
        } else {
            // Quên bài
            repetition = 0;
            interval = 0; // CẢI TIẾN: 0 ngày = Thẻ sẽ đáo hạn lại ngay trong hôm nay
        }

        // Tính toán lại độ khó (Ease Factor)
        easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (easeFactor < 1.3) easeFactor = 1.3;

        let nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + interval);

        return {
            status: 'reviewing',
            repetition: repetition,
            interval: interval,
            easeFactor: easeFactor,
            nextReview: nextDate.getTime()
        };
    }

    // --- CẬP NHẬT: VẼ DANH SÁCH TẤT CẢ TỪ TRONG SRS ---
    function renderSRSList() {
        if (!srsListContainer) return;
        srsListContainer.innerHTML = '';
        
        const now = new Date().getTime();

        allUpcomingCards.forEach((item) => {
            const card = item.wordData;
            const reviewDate = new Date(item.progress.nextReview);
            const dateString = reviewDate.toLocaleDateString('vi-VN');
            
            // Nếu thời gian hẹn <= hiện tại tức là đang nợ bài
            const isDue = item.progress.nextReview <= now;

            // Làm mờ những thẻ chưa đến ngày học
            const row = document.createElement('div');
            row.className = `word-list-item ${!isDue ? 'learned' : ''}`; 
            
            const statusHTML = isDue 
                ? `<span style="font-size: 12px; color: #ff5252; background: #ffebee; padding: 4px 8px; border-radius: 4px; border: 1px solid #ffcdd2;"><i class="fa-solid fa-fire"></i> Đến hạn ôn</span>`
                : `<span style="font-size: 12px; color: #4caf50; background: #e8f5e9; padding: 4px 8px; border-radius: 4px; border: 1px solid #c8e6c9;"><i class="fa-regular fa-calendar"></i> ${dateString}</span>`;

            row.innerHTML = `
                <div>
                    <h4 style="font-size:18px;">${card.term} <span style="font-size:12px; color:#777; font-weight:normal;">${card.pronunciation || ''}</span></h4>
                    <p style="color:#555; font-size:14px; margin-top:5px;">${card.type ? card.type + ' - ' : ''} ${card.definition}</p>
                </div>
                <div style="text-align: right; display: flex; align-items: center; gap: 10px;">
                    ${statusHTML}
                </div>
            `;
            srsListContainer.appendChild(row);
        });
    }

    // 2. GOM THẺ VÀ TÁCH MẢNG
    async function fetchDueCards() {
        if (!currentUser) return;
        try {
            const q = query(collection(db, "user_progress"), where("userId", "==", currentUser.uid));
            const querySnapshot = await getDocs(q);
            const now = new Date().getTime();

            for (const docSnap of querySnapshot.docs) {
                const progressData = docSnap.data();
                const setId = progressData.setId;
                const learnedCards = progressData.learnedCards || {};

                const setDocSnap = await getDoc(doc(db, "study_sets", setId));
                if (!setDocSnap.exists()) continue;
                
                const wordsArray = setDocSnap.data().words || [];

                for (const [index, pData] of Object.entries(learnedCards)) {
                    if (pData.status === 'reviewing') {
                        const cardObj = {
                            setId: setId,
                            wordIndex: index,
                            wordData: wordsArray[index],
                            progress: pData
                        };
                        
                        // 1. Cho vào mảng hiển thị tổng
                        allUpcomingCards.push(cardObj); 

                        // 2. CHỈ thẻ nào đến hạn mới đưa vào mảng học 3D
                        if (pData.nextReview <= now) {
                            dueCards.push(cardObj);
                        }
                    }
                }
            }

            // Sắp xếp cả 2 mảng theo thứ tự ngày xa dần
            dueCards.sort((a, b) => a.progress.nextReview - b.progress.nextReview);
            allUpcomingCards.sort((a, b) => a.progress.nextReview - b.progress.nextReview);
            
            updateUI();
            renderSRSList(); 

        } catch (error) {
            console.error("Lỗi tải thẻ SRS:", error);
        }
    }

    // 3. CẬP NHẬT THẺ 3D
    function updateUI() {
        counterDisplay.textContent = dueCards.length - currentCardIndex;
        srsControls.style.display = 'none';
        flashcard.classList.remove('is-flipped');

        if (currentCardIndex >= dueCards.length) {
            document.getElementById('fc-front-word').textContent = "Hoàn thành!";
            document.getElementById('fc-front-pron').textContent = "Bạn đã ôn hết các từ đến hạn hôm nay.";
            flashcard.style.pointerEvents = 'none'; 
            return;
        }

        const card = dueCards[currentCardIndex].wordData;
        
        document.getElementById('fc-front-word').textContent = card.term;
        document.getElementById('fc-front-pron').textContent = ''; 

        const typePron = `${card.type ? card.type + ' - ' : ''} ${card.pronunciation || ''}`.trim();
        document.getElementById('fc-back-def').innerHTML = 
            (typePron ? `<span style="font-size: 16px; color: #777; font-weight: normal; display: block; margin-bottom: 8px;">${typePron}</span>` : '') + 
            card.definition;
        
        const synElement = document.getElementById('fc-back-syn');
        if (card.synonyms) { synElement.textContent = card.synonyms.replace(/,/g, ';'); synElement.style.display = 'block'; } 
        else { synElement.style.display = 'none'; }

        const exElement = document.getElementById('fc-back-ex');
        if (card.example) { exElement.textContent = card.example; exElement.style.display = 'block'; } 
        else { exElement.style.display = 'none'; }
    }

    // 4. XỬ LÝ KHI ĐÁNH GIÁ THẺ
    async function processEvaluation(quality) {
        if (currentCardIndex >= dueCards.length) return;
        const currentData = dueCards[currentCardIndex];
        const newProgress = calculateSM2(quality, currentData.progress);
        
        // CẬP NHẬT MẢNG TỔNG: Tìm và gán dữ liệu mới để nó nhảy ngày
        const upcomingIndex = allUpcomingCards.findIndex(c => c.setId === currentData.setId && c.wordIndex === currentData.wordIndex);
        if(upcomingIndex !== -1) {
            allUpcomingCards[upcomingIndex].progress = newProgress;
        }

        // Sắp xếp lại danh sách tổng (thẻ vừa học sẽ bị đẩy tít xuống dưới cùng)
        allUpcomingCards.sort((a, b) => a.progress.nextReview - b.progress.nextReview);

        try {
            const progressRef = doc(db, "user_progress", `${currentUser.uid}_${currentData.setId}`);
            const snap = await getDoc(progressRef);
            let allLearnedCards = snap.exists() ? snap.data().learnedCards : {};
            
            allLearnedCards[currentData.wordIndex] = newProgress;
            await updateDoc(progressRef, { learnedCards: allLearnedCards });
        } catch (error) {
            console.error("Lỗi lưu SM-2:", error);
        }

        currentCardIndex++;
        updateUI();
        renderSRSList(); // Chạy lại hàm vẽ để thay đổi nhãn đỏ thành xanh
    }

    document.getElementById('btn-sm2-0').addEventListener('click', () => processEvaluation(0));
    document.getElementById('btn-sm2-3').addEventListener('click', () => processEvaluation(3));
    document.getElementById('btn-sm2-4').addEventListener('click', () => processEvaluation(4));
    document.getElementById('btn-sm2-5').addEventListener('click', () => processEvaluation(5));

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'Enter') { 
            e.preventDefault(); 
            if(dueCards.length > 0 && currentCardIndex < dueCards.length) {
                flashcard.classList.toggle('is-flipped');
                srsControls.style.display = flashcard.classList.contains('is-flipped') ? 'flex' : 'none';
            }
        }
        if (srsControls.style.display === 'flex') {
            if (e.key === '1') processEvaluation(0);
            if (e.key === '2') processEvaluation(3);
            if (e.key === '3') processEvaluation(4);
            if (e.key === '4') processEvaluation(5);
        }
    });

    onAuthStateChanged(auth, (user) => {
        if (user) { fetchDueCards(); } 
        else { alert("Vui lòng đăng nhập!"); window.location.href="index.html"; }
    });
}



// ==========================================
// 8. LOGIC TRANG TRẮC NGHIỆM (quiz.html)
// ==========================================
if (currentPage === 'quiz') {
    const urlParams = new URLSearchParams(window.location.search);
    const setId = urlParams.get('id');
    const filterType = urlParams.get('filter') || 'all'; 
    const mode = urlParams.get('mode') || 'mixed'; 
    const limit = urlParams.get('limit') || '10'; 

    let allWordsInSet = [];
    let quizPool = []; // Lưu object gồm { wordData, originalIndex }
    let currentQuestionIndex = 0;
    let score = 0;
    let questions = []; 
    let currentStreak = 0;
    let bestStreak = 0;
    let hasAnsweredCurrentQuestion = false;

    const actionBar = document.getElementById('quiz-action-bar');
    const btnNext = document.getElementById('btn-quiz-next');
    const btnFail = document.getElementById('btn-quiz-fail');
    const btnPass = document.getElementById('btn-quiz-pass');
    const feedback = document.getElementById('quiz-feedback');
    const audioButton = document.getElementById('btn-quiz-audio');

    function speakQuizWord(text) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
    }

    // 1. TẠO ĐÁP ÁN NHIỄU
    function generateDistractors(correctWord, poolToPick) {
        let options = [correctWord];
        let available = poolToPick.filter(w => w.term !== correctWord.term);
        
        if (correctWord.type) {
            let sameType = available.filter(w => w.type === correctWord.type);
            sameType.sort(() => Math.random() - 0.5);
            while(options.length < 4 && sameType.length > 0) {
                options.push(sameType.pop());
                available = available.filter(w => w.term !== options[options.length-1].term);
            }
        }

        available.sort(() => Math.random() - 0.5);
        while(options.length < 4 && available.length > 0) {
            options.push(available.pop());
        }
        return options.sort(() => Math.random() - 0.5);
    }

    // 2. KHỞI TẠO BÀI THI
    async function initQuiz() {
        if (!setId) return alert("Lỗi ID bộ thẻ!");
        try {
            const docSnap = await getDoc(doc(db, "study_sets", setId));
            if (!docSnap.exists()) return alert("Bộ thẻ không tồn tại.");
            allWordsInSet = docSnap.data().words || [];

            if(allWordsInSet.length < 4) {
                alert("Bộ thẻ cần ít nhất 4 từ để chơi trắc nghiệm!");
                window.location.href = `study.html?id=${setId}`;
                return;
            }

            let learnedStatus = {};
            if (currentUser) {
                const progSnap = await getDoc(doc(db, "user_progress", `${currentUser.uid}_${setId}`));
                if (progSnap.exists()) learnedStatus = progSnap.data().learnedCards || {};
            }

            // Gắn originalIndex để biết từ này nằm ở đâu trong mảng gốc
            allWordsInSet.forEach((word, index) => {
                const isLearned = learnedStatus[index] && learnedStatus[index].status === 'learned';
                const wordObj = { wordData: word, originalIndex: index };
                
                if (filterType === 'all') quizPool.push(wordObj);
                else if (filterType === 'learned' && isLearned) quizPool.push(wordObj);
                else if (filterType === 'unlearned' && !isLearned) quizPool.push(wordObj);
            });

            if (quizPool.length === 0) {
                alert("Không có từ vựng nào khớp với bộ lọc của bạn!");
                window.location.href = `study.html?id=${setId}`;
                return;
            }

            quizPool.sort(() => Math.random() - 0.5); 
            if (limit !== 'all' && quizPool.length > parseInt(limit)) {
                quizPool = quizPool.slice(0, parseInt(limit));
            }

            questions = quizPool.map(item => {
                const options = generateDistractors(item.wordData, allWordsInSet);
                let qMode = mode === 'mixed' ? (Math.random() > 0.5 ? 'en-vi' : 'vi-en') : mode;
                return {
                    mode: qMode,
                    correctWord: item.wordData,
                    originalIndex: item.originalIndex,
                    options: options
                };
            });

            renderQuestion();
        } catch (e) { console.error("Lỗi:", e); }
    }

    // 3. VẼ CÂU HỎI
    function renderQuestion() {
        if (currentQuestionIndex >= questions.length) return showResult();

        const qData = questions[currentQuestionIndex];
        const isEnToVi = qData.mode === 'en-vi';

        actionBar.style.display = 'none'; // Ẩn thanh công cụ
        hasAnsweredCurrentQuestion = false;
        
        // Reset text nút bấm
        btnFail.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Vào SRS (Chưa nhớ)';
        btnPass.innerHTML = '<i class="fa-solid fa-check"></i> Đã thuộc (Bỏ qua)';
        btnFail.disabled = false;
        btnPass.disabled = false;

        document.getElementById('quiz-progress-text').textContent = `Câu ${currentQuestionIndex + 1} / ${questions.length}`;
        document.getElementById('quiz-progress-fill').style.width = `${(currentQuestionIndex / questions.length) * 100}%`;
        document.getElementById('quiz-score-live').textContent = score;
        document.getElementById('quiz-streak').textContent = currentStreak;
        document.getElementById('quiz-mode-badge').innerHTML = isEnToVi
            ? '<i class="fa-solid fa-language"></i> Tiếng Anh → Tiếng Việt'
            : '<i class="fa-solid fa-language"></i> Tiếng Việt → Tiếng Anh';
        document.getElementById('quiz-question-text').textContent = isEnToVi ? qData.correctWord.term : qData.correctWord.definition;
        // Không hiển thị gợi ý trong lúc trả lời: một số bộ thẻ cũ lưu nghĩa vào
        // trường phát âm, khiến đáp án bị lộ ngay dưới câu hỏi.
        const questionHint = document.getElementById('quiz-question-hint');
        questionHint.textContent = '';
        questionHint.style.display = 'none';
        audioButton.classList.toggle('visible', Boolean(qData.correctWord.term));
        audioButton.onclick = () => speakQuizWord(qData.correctWord.term);

        const grid = document.getElementById('quiz-options-grid');
        grid.innerHTML = '';

        qData.options.forEach((opt, optionIndex) => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option-btn';
            btn.innerHTML = `<span>${isEnToVi ? opt.definition : opt.term}</span><span class="quiz-option-key">${String.fromCharCode(65 + optionIndex)}</span>`;
            btn.dataset.optionIndex = optionIndex;
            
            btn.addEventListener('click', () => {
                document.querySelectorAll('.quiz-option-btn').forEach(b => b.classList.add('disabled'));

                const isCorrect = opt === qData.correctWord;
                if (isCorrect) {
                    btn.classList.add('correct');
                    score++;
                    currentStreak++;
                    bestStreak = Math.max(bestStreak, currentStreak);
                } else {
                    btn.classList.add('wrong');
                    currentStreak = 0;
                    document.querySelectorAll('.quiz-option-btn').forEach(b => {
                        if (Number(b.dataset.optionIndex) === qData.options.indexOf(qData.correctWord)) b.classList.add('correct');
                    });
                }
                hasAnsweredCurrentQuestion = true;
                document.getElementById('quiz-score-live').textContent = score;
                document.getElementById('quiz-streak').textContent = currentStreak;
                feedback.className = `quiz-feedback ${isCorrect ? 'is-correct' : 'is-wrong'}`;
                feedback.innerHTML = isCorrect
                    ? `<i class="fa-solid fa-circle-check"></i><span><strong>Chính xác!</strong> Bạn đã chọn đúng đáp án.</span>`
                    : `<i class="fa-solid fa-circle-xmark"></i><span><strong>Chưa chính xác.</strong> Đáp án đúng: ${isEnToVi ? qData.correctWord.definition : qData.correctWord.term}</span>`;
                // Hiện thanh công cụ để người dùng tự bấm Next hoặc Đánh giá
                actionBar.style.display = 'flex';
            });
            grid.appendChild(btn);
        });
    }

    // 4. CẬP NHẬT TIẾN ĐỘ TRỰC TIẾP TỪ QUIZ
    async function updateWordStatus(statusType, btnElement) {
        if (!currentUser) return alert("Vui lòng đăng nhập!");
        const qData = questions[currentQuestionIndex];
        const progressRef = doc(db, "user_progress", `${currentUser.uid}_${setId}`);
        
        btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
        
        try {
            const snap = await getDoc(progressRef);
            let allCards = snap.exists() ? snap.data().learnedCards : {};
            
            if (statusType === 'learned') {
                allCards[qData.originalIndex] = { status: 'learned' };
            } else {
                allCards[qData.originalIndex] = {
                    status: 'reviewing', repetition: 0, interval: 0, easeFactor: 2.5, nextReview: new Date().getTime()
                };
            }
            
            await setDoc(progressRef, { userId: currentUser.uid, setId: setId, learnedCards: allCards }, { merge: true });
            
            btnElement.innerHTML = statusType === 'learned' ? '<i class="fa-solid fa-check-double"></i> Đã lưu vào Đã thuộc' : '<i class="fa-solid fa-check-double"></i> Đã đưa vào SRS';
            btnFail.disabled = true; btnPass.disabled = true; // Khóa nút chống bấm 2 lần
        } catch (error) { console.error("Lỗi:", error); }
    }

    // Gắn sự kiện thanh công cụ
    btnFail.addEventListener('click', () => updateWordStatus('reviewing', btnFail));
    btnPass.addEventListener('click', () => updateWordStatus('learned', btnPass));
    btnNext.addEventListener('click', () => { currentQuestionIndex++; renderQuestion(); });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && hasAnsweredCurrentQuestion) {
            event.preventDefault();
            btnNext.click();
            return;
        }
        if (hasAnsweredCurrentQuestion || event.ctrlKey || event.metaKey || event.altKey) return;
        const choiceIndex = ['a', 'b', 'c', 'd'].indexOf(event.key.toLowerCase());
        if (choiceIndex >= 0) document.querySelector(`.quiz-option-btn[data-option-index="${choiceIndex}"]`)?.click();
    });

    // 5. HIỂN THỊ KẾT QUẢ
    function showResult() {
        document.getElementById('quiz-play-area').style.display = 'none';
        document.getElementById('quiz-result-area').style.display = 'block';
        document.getElementById('score-correct').textContent = score;
        document.getElementById('score-total').textContent = questions.length;
        document.getElementById('score-percent').textContent = `${Math.round((score / questions.length) * 100)}%`;
        document.getElementById('result-correct').textContent = score;
        document.getElementById('result-incorrect').textContent = questions.length - score;
        document.getElementById('result-streak').textContent = bestStreak;
        document.getElementById('quiz-progress-fill').style.width = '100%';
    }

    document.getElementById('btn-quit-quiz').addEventListener('click', () => window.location.href = `study.html?id=${setId}`);
    document.getElementById('btn-back-to-study').addEventListener('click', () => window.location.href = `study.html?id=${setId}`);
    document.getElementById('btn-replay').addEventListener('click', () => window.location.reload());

    onAuthStateChanged(auth, (user) => {
        if(user) initQuiz();
        else { alert("Vui lòng đăng nhập!"); window.location.href="index.html"; }
    });
}
