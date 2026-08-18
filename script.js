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



// 2. TẢI VÀ VẼ LƯỚI
async function loadSets(pageType) {
    if (!currentUser || !grid) return;
    grid.innerHTML = '<p>Đang tải dữ liệu...</p>';

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
        if (!currentUser) return alert("Vui lòng đăng nhập!");
        const title = document.getElementById('set-title').value.trim();
        if (!title) return alert("Vui lòng nhập Tiêu đề!");

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
                alert("Cập nhật thành công!");
                window.location.href = `study.html?id=${editId}`;
            } else {
                setData.ownerId = currentUser.uid;
                setData.authorName = currentUser.displayName;
                setData.timestamp = new Date();
                await addDoc(collection(db, "study_sets"), setData);
                alert("Tạo bộ thẻ thành công!");
                window.location.href = "created.html";
            }
        } catch (error) {
            console.error("Lỗi:", error);
            alert("Có lỗi xảy ra khi lưu.");
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
if (currentPage === 'study') {
    const urlParams = new URLSearchParams(window.location.search);
    const setId = urlParams.get('id');

    let wordsArray = [];
    let currentIndex = 0;
    let studyProgress = {}; 

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

        document.getElementById('fc-front-word').textContent = currentWord.term;
        document.getElementById('fc-front-pron').textContent = `${currentWord.type ? currentWord.type + ' - ' : ''} ${currentWord.pronunciation || ''}`;
        
        document.getElementById('fc-back-def').textContent = currentWord.definition;
        
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

    function renderList() {
        wordListContainer.innerHTML = '';
        wordsArray.forEach((word, index) => {
            const isLearned = studyProgress[index] === true;
            
            const row = document.createElement('div');
            row.className = `word-list-item ${isLearned ? 'learned' : ''}`;
            row.innerHTML = `
                <div>
                    <h4 style="font-size:18px;">${word.term} <span style="font-size:12px; color:#777; font-weight:normal;">${word.pronunciation}</span></h4>
                    <p style="color:#555; font-size:14px; margin-top:5px;">${word.type ? word.type + ' - ' : ''} ${word.definition}</p>
                </div>
                <div>
                    ${isLearned ? '<i class="fa-solid fa-check-circle" style="color:#4caf50; font-size:20px;"></i>' : '<i class="fa-solid fa-circle-minus" style="color:#fbbc05; font-size:20px;"></i>'}
                </div>
            `;
            wordListContainer.appendChild(row);
        });
    }

    // --- TÍNH NĂNG MỚI: LƯU TIẾN ĐỘ LÊN FIREBASE ---
    async function saveProgress() {
        if (!currentUser || !setId) return;
        
        // Tạo một ID duy nhất kết hợp giữa UID của user và ID bộ thẻ
        const progressRef = doc(db, "user_progress", `${currentUser.uid}_${setId}`);
        try {
            // Dùng setDoc với tùy chọn { merge: true } để tạo mới nếu chưa có, hoặc chỉ ghi đè thuộc tính learnedCards nếu đã có
            await setDoc(progressRef, { learnedCards: studyProgress }, { merge: true });
        } catch (error) {
            console.error("Lỗi lưu tiến độ:", error);
        }
    }

    // --- CẬP NHẬT: TẢI KÈM TIẾN ĐỘ TỪ FIREBASE KHI MỞ TRANG ---
    async function loadStudyData() {
        if (!setId) return alert("Không tìm thấy ID bộ thẻ!");
        try {
            const docRef = doc(db, "study_sets", setId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                document.getElementById('study-set-title').textContent = data.title;
                wordsArray = data.words || [];

                // Tải file tiến độ về (nếu có)
                if (currentUser) {
                    const progressRef = doc(db, "user_progress", `${currentUser.uid}_${setId}`);
                    const progressSnap = await getDoc(progressRef);
                    if (progressSnap.exists()) {
                        studyProgress = progressSnap.data().learnedCards || {};
                    }
                    // KIỂM TRA QUYỀN CHỦ SỞ HỮU ĐỂ HIỆN NÚT SỬA
                    if (data.ownerId === currentUser.uid) {
                        const btnEdit = document.getElementById('btn-edit-set');
                        btnEdit.style.display = 'inline-block';
                        btnEdit.href = `create.html?id=${setId}`; // Chuyển sang trang tạo kèm theo ID
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

    // --- CẬP NHẬT: GỌI HÀM LƯU MỖI KHI BẤM CHẤM ĐIỂM ---
    document.getElementById('btn-fail').addEventListener('click', () => {
        studyProgress[currentIndex] = false; 
        saveProgress(); // Bí mật đẩy lên mạng
        if (currentIndex < wordsArray.length - 1) { currentIndex++; updateUI(); } else { renderList(); }
    });
    
    document.getElementById('btn-pass').addEventListener('click', () => {
        studyProgress[currentIndex] = true; 
        saveProgress(); // Bí mật đẩy lên mạng
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
