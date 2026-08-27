import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where, addDoc, getDoc, setDoc, updateDoc, runTransaction } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, getAdditionalUserInfo } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

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
let hasAdminAccess = false;
const NEW_USER_WELCOME_KEY = 'supervocab:new-user-welcome';
const avatarBtn = document.getElementById('nav-avatar');
const themeStorageKey = 'supervocab:theme';
const themeToggle = document.createElement('button');
themeToggle.id = 'btn-theme-toggle';
themeToggle.className = 'icon-btn theme-toggle';
themeToggle.type = 'button';
themeToggle.title = 'Chuyển chế độ tối';
themeToggle.setAttribute('aria-label', 'Chuyển chế độ tối');
const navRight = document.querySelector('.top-nav .nav-right');
if (navRight) navRight.insertBefore(themeToggle, avatarBtn || navRight.firstChild);
const grid = document.getElementById('learning-sets-grid');
const personalGrid = document.getElementById('personal-sets-grid');
const personalLibrarySection = document.getElementById('personal-library-section');
const searchModal = document.getElementById('search-modal');
const searchInput = document.getElementById('search-sets');
const searchEmpty = document.getElementById('search-empty');
const searchResults = document.getElementById('search-results');
const progressFilter = document.getElementById('filter-set-progress');
const visibilityFilter = document.getElementById('filter-set-visibility');
const setSort = document.getElementById('sort-sets');

const siteFooter = document.createElement('footer');
siteFooter.className = 'site-footer';
siteFooter.innerHTML = '<a class="site-footer-brand" href="/" aria-label="Về trang chủ"><img src="/assets/brand-mark.png" alt=""> <strong>SuperVocab</strong></a><span>Development by Do Quang Thang</span>';
document.body.append(siteFooter);

const pageTransition = document.createElement('div');
pageTransition.className = 'page-transition';
pageTransition.setAttribute('aria-hidden', 'true');
pageTransition.innerHTML = '<div class="page-transition-content"><span class="brand-loader-mark"><img src="/assets/brand-mark.png" alt=""></span><p id="page-transition-label">Đang chuyển trang</p></div>';
document.body.append(pageTransition);
let pageNavigationInProgress = false;
const activeCardTransitions = new WeakSet();

function showPageTransition(label = 'Đang chuyển trang') {
    document.getElementById('page-transition-label').textContent = label;
    pageTransition.classList.add('is-visible');
    pageTransition.setAttribute('aria-hidden', 'false');
}

function hidePageTransition() {
    pageTransition.classList.remove('is-visible');
    pageTransition.classList.remove('is-navigation-transition');
    pageTransition.setAttribute('aria-hidden', 'true');
}

function navigateTo(target, label = 'Đang chuyển trang') {
    if (pageNavigationInProgress) return;
    const targetUrl = new URL(target, window.location.href);
    if (targetUrl.origin !== window.location.origin || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        window.location.assign(targetUrl.href);
        return;
    }

    pageNavigationInProgress = true;
    document.documentElement.classList.add('is-page-leaving');
    pageTransition.classList.add('is-navigation-transition');
    showPageTransition(label);
    window.setTimeout(() => window.location.assign(targetUrl.href), 180);
}

async function transitionCardContent(container, updateContent, direction = 'next') {
    if (!container || activeCardTransitions.has(container)) return false;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || typeof container.animate !== 'function') {
        updateContent();
        return true;
    }

    activeCardTransitions.add(container);
    container.classList.add('is-changing-card');
    const horizontalOffset = direction === 'previous' ? 26 : direction === 'next' ? -26 : 0;
    const verticalOffset = direction === 'random' ? -10 : 0;
    let outgoingAnimation;
    let contentUpdated = false;

    try {
        outgoingAnimation = container.animate([
            { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
            { opacity: 0, transform: `translate3d(${horizontalOffset}px, ${verticalOffset}px, 0) scale(.985)` }
        ], { duration: 145, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
        await outgoingAnimation.finished;

        // Nội dung chỉ được thay khi toàn bộ thẻ đã ẩn, nên mặt sau mới không thể bị lộ.
        updateContent();
        contentUpdated = true;
        outgoingAnimation.cancel();

        const incomingX = horizontalOffset === 0 ? 0 : -horizontalOffset;
        const incomingY = direction === 'random' ? 10 : 0;
        const incomingAnimation = container.animate([
            { opacity: 0, transform: `translate3d(${incomingX}px, ${incomingY}px, 0) scale(.985)` },
            { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
        ], { duration: 195, easing: 'cubic-bezier(.16,1,.3,1)' });
        await incomingAnimation.finished;
        return true;
    } catch (error) {
        outgoingAnimation?.cancel();
        if (!contentUpdated) updateContent();
        return true;
    } finally {
        container.classList.remove('is-changing-card');
        activeCardTransitions.delete(container);
    }
}

function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    themeToggle.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    const label = isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối';
    themeToggle.title = label;
    themeToggle.setAttribute('aria-label', label);
}

const savedTheme = localStorage.getItem(themeStorageKey);
applyTheme(savedTheme || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
themeToggle.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(themeStorageKey, nextTheme);
    applyTheme(nextTheme);
});

function brandLoadingMarkup(label = 'Đang tải dữ liệu...') {
    return `<div class="brand-inline-loader" role="status"><span class="brand-loader-mark"><img src="/assets/brand-mark.png" alt=""></span><p>${escapeHTML(label)}</p></div>`;
}

function brandButtonLoading(label = 'Đang tải...') {
    return `<span class="brand-button-loader" aria-hidden="true"><img src="/assets/brand-mark.png" alt=""></span>${escapeHTML(label)}`;
}

document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download') || link.dataset.noLoader !== undefined) return;
    const targetUrl = new URL(link.href, window.location.href);
    const isSameDocument = targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search;
    if (targetUrl.origin === window.location.origin && !isSameDocument) {
        event.preventDefault();
        navigateTo(targetUrl.href);
    }
});
window.addEventListener('pageshow', (event) => {
    pageNavigationInProgress = false;
    document.documentElement.classList.remove('is-page-leaving');
    hidePageTransition();
    if (event.persisted && typeof document.body.animate === 'function') {
        document.body.animate([
            { opacity: 0, transform: 'translateY(7px)' },
            { opacity: 1, transform: 'none' }
        ], { duration: 230, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
});

const accountDrawer = document.createElement('aside');
accountDrawer.id = 'account-drawer';
accountDrawer.className = 'account-drawer';
accountDrawer.setAttribute('aria-label', 'Tài khoản và cài đặt');
accountDrawer.setAttribute('aria-hidden', 'true');
accountDrawer.innerHTML = `
    <div class="account-drawer-header"><span>Tài khoản</span><button id="btn-close-account-drawer" type="button" aria-label="Đóng bảng tài khoản"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="account-profile"><div class="account-profile-avatar" id="account-profile-avatar"><i class="fa-solid fa-user"></i></div><div><strong id="account-profile-name">Khách</strong><span id="account-profile-email">Đăng nhập để đồng bộ dữ liệu</span></div></div>
    <div class="account-drawer-menu"><p>Hệ thống</p><button id="btn-account-settings" type="button"><i class="fa-solid fa-sliders"></i><span>Cài đặt & dữ liệu</span><i class="fa-solid fa-chevron-right menu-arrow"></i></button><a href="/created/"><i class="fa-regular fa-folder-open"></i><span>Bộ thẻ của tôi</span><i class="fa-solid fa-chevron-right menu-arrow"></i></a><a id="btn-admin-panel" href="/admin/" hidden><i class="fa-solid fa-shield-halved"></i><span>Quản trị nội dung</span><i class="fa-solid fa-chevron-right menu-arrow"></i></a></div>
    <div class="account-drawer-footer"><button id="btn-account-logout" type="button"><i class="fa-solid fa-arrow-right-from-bracket"></i> Đăng xuất</button></div>
`;
const accountDrawerBackdrop = document.createElement('div');
accountDrawerBackdrop.className = 'account-drawer-backdrop';
document.body.append(accountDrawerBackdrop, accountDrawer);

function closeAccountDrawer() {
    accountDrawer.classList.remove('is-open');
    accountDrawerBackdrop.classList.remove('is-open');
    accountDrawer.setAttribute('aria-hidden', 'true');
}

function openAccountDrawer() {
    if (!currentUser) return;
    accountDrawer.classList.add('is-open');
    accountDrawerBackdrop.classList.add('is-open');
    accountDrawer.setAttribute('aria-hidden', 'false');
    document.getElementById('btn-close-account-drawer')?.focus();
}

function requestSignIn(feature = 'sử dụng tính năng này') {
    showError(`Hãy đăng nhập để ${feature}.`);
}

async function startGoogleSignIn() {
    try {
        const credential = await signInWithPopup(auth, provider);
        if (getAdditionalUserInfo(credential)?.isNewUser) {
            sessionStorage.setItem(NEW_USER_WELCOME_KEY, credential.user.uid);
            showNewUserWelcome(credential.user);
        }
    } catch (error) {
        console.error('Không thể đăng nhập:', error);
        showError('Không thể đăng nhập. Vui lòng thử lại.');
    }
}

function showNewUserWelcome(user) {
    if (currentPage !== 'home' || !user) return;
    const welcomeModal = document.getElementById('new-user-welcome-modal');
    if (!welcomeModal) return;
    const hasPendingWelcome = sessionStorage.getItem(NEW_USER_WELCOME_KEY) === user.uid;
    const hasSeenWelcome = localStorage.getItem(`${NEW_USER_WELCOME_KEY}:${user.uid}`) === 'seen';
    if (!hasPendingWelcome || hasSeenWelcome) return;

    sessionStorage.removeItem(NEW_USER_WELCOME_KEY);
    localStorage.setItem(`${NEW_USER_WELCOME_KEY}:${user.uid}`, 'seen');
    welcomeModal.style.display = 'flex';
}

document.getElementById('btn-close-account-drawer')?.addEventListener('click', closeAccountDrawer);
accountDrawerBackdrop.addEventListener('click', closeAccountDrawer);
document.getElementById('btn-account-logout')?.addEventListener('click', async () => {
    await signOut(auth);
    closeAccountDrawer();
});
document.getElementById('btn-account-settings')?.addEventListener('click', () => {
    closeAccountDrawer();
    if (currentPage === 'home') {
        document.getElementById('settings-modal')?.style.setProperty('display', 'flex');
    } else {
        navigateTo('/#settings');
    }
});

function renderAdminAccessState(message, icon = 'fa-lock') {
    const accessState = document.getElementById('admin-access-state');
    const reviewContent = document.getElementById('admin-review-content');
    if (!accessState) return;
    accessState.hidden = false;
    if (reviewContent) reviewContent.hidden = true;
    accessState.innerHTML = `<i class="fa-solid ${icon}"></i><h2>${escapeHTML(message.title)}</h2><p>${escapeHTML(message.description)}</p>${message.action || ''}`;
}

function formatAdminDate(value) {
    try {
        const date = value?.toDate ? value.toDate() : (value ? new Date(value) : null);
        return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date) : 'Chưa có ngày tạo';
    } catch { return 'Chưa có ngày tạo'; }
}

async function loadAdminReviewQueue() {
    const queueGrid = document.getElementById('admin-pending-grid');
    const reviewContent = document.getElementById('admin-review-content');
    const queueCount = document.getElementById('admin-queue-count');
    if (!queueGrid || !reviewContent || !currentUser || !hasAdminAccess) return;

    reviewContent.hidden = false;
    queueGrid.innerHTML = `<div class="admin-empty">${brandLoadingMarkup('Đang tải hàng chờ duyệt...')}</div>`;
    try {
        const pendingSnapshot = await getDocs(query(collection(db, 'study_sets'), where('publicationStatus', '==', 'pending')));
        queueCount.textContent = `${pendingSnapshot.size} bộ thẻ`;
        if (pendingSnapshot.empty) {
            queueGrid.innerHTML = '<div class="admin-empty"><i class="fa-solid fa-circle-check"></i><h3>Hàng chờ đang trống</h3><p>Tất cả yêu cầu công khai đã được xử lý.</p></div>';
            return;
        }

        queueGrid.innerHTML = '';
        pendingSnapshot.forEach((setDoc) => {
            const data = setDoc.data();
            const words = Array.isArray(data.words) ? data.words : [];
            const previewTerms = words.slice(0, 6).map((word) => `<span>${escapeHTML(word.term || '')}</span>`).join('');
            const card = document.createElement('article');
            card.className = 'admin-review-card';
            card.innerHTML = `
                <div class="admin-review-card-head"><span class="admin-pending-badge"><i class="fa-solid fa-clock"></i> Chờ duyệt</span><span>${formatAdminDate(data.timestamp)}</span></div>
                <h3>${escapeHTML(data.title || 'Chưa đặt tên')}</h3>
                <p class="admin-review-description">${escapeHTML(data.description || 'Không có mô tả')}</p>
                <div class="admin-review-meta"><span><i class="fa-regular fa-user"></i> ${escapeHTML(data.authorName || 'Ẩn danh')}</span><span><i class="fa-solid fa-layer-group"></i> ${words.length} từ</span></div>
                <details class="admin-word-preview"><summary>Xem nhanh nội dung</summary><div>${previewTerms || '<span>Chưa có từ vựng</span>'}</div></details>
                <div class="admin-review-actions"><button class="btn admin-reject-btn" type="button" data-action="reject"><i class="fa-solid fa-xmark"></i> Từ chối</button><button class="btn btn-black" type="button" data-action="approve"><i class="fa-solid fa-check"></i> Duyệt công khai</button></div>
            `;
            card.querySelector('[data-action="approve"]').addEventListener('click', async () => {
                await updateReviewStatus(setDoc.id, 'approved');
            });
            card.querySelector('[data-action="reject"]').addEventListener('click', async () => {
                const note = window.prompt('Lý do từ chối (tùy chọn):', '');
                if (note === null) return;
                await updateReviewStatus(setDoc.id, 'rejected', note.trim());
            });
            queueGrid.appendChild(card);
        });
    } catch (error) {
        console.error('Không thể tải hàng chờ duyệt:', error);
        queueGrid.innerHTML = '<div class="admin-empty"><i class="fa-solid fa-triangle-exclamation"></i><h3>Chưa thể tải hàng chờ</h3><p>Kiểm tra quyền admin và thử lại.</p></div>';
    }
}

async function updateReviewStatus(setId, status, note = '') {
    if (!currentUser || !hasAdminAccess) return;
    const actionText = status === 'approved' ? 'duyệt công khai' : 'từ chối';
    try {
        await updateDoc(doc(db, 'study_sets', setId), {
            isPublic: status === 'approved',
            publicationStatus: status,
            reviewedAt: new Date(),
            reviewedBy: currentUser.uid,
            adminNote: note
        });
        showToast(`Đã ${actionText} bộ thẻ.`, 'success');
        loadAdminReviewQueue();
    } catch (error) {
        console.error('Không thể cập nhật trạng thái duyệt:', error);
        handleFirebaseError(error);
    }
}

function formatUserDate(value) {
    try {
        const date = value?.toDate ? value.toDate() : (value ? new Date(value) : null);
        return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date) : 'Chưa có dữ liệu';
    } catch { return 'Chưa có dữ liệu'; }
}

async function ensureUserProfile(user) {
    if (!user) return;
    try {
        const profileRef = doc(db, 'users', user.uid);
        const existing = await getDoc(profileRef);
        const profile = { userId: user.uid, displayName: user.displayName || 'Người học', email: user.email || '', photoURL: user.photoURL || '', lastActiveAt: new Date() };
        if (!existing.exists()) profile.joinedAt = new Date();
        await setDoc(profileRef, profile, { merge: true });
    } catch (error) { console.warn('Không thể đồng bộ hồ sơ người dùng:', error); }
}

async function loadAdminUsers() {
    const usersGrid = document.getElementById('admin-users-grid');
    const userCount = document.getElementById('admin-user-count');
    if (!usersGrid || !currentUser || !hasAdminAccess) return;
    usersGrid.innerHTML = `<div class="admin-empty">${brandLoadingMarkup('Đang tải người dùng...')}</div>`;
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const users = usersSnapshot.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() })).sort((a, b) => (b.lastActiveAt?.toMillis?.() || 0) - (a.lastActiveAt?.toMillis?.() || 0));
        userCount.textContent = `${users.length} người dùng`;
        if (!users.length) { usersGrid.innerHTML = '<div class="admin-empty"><i class="fa-solid fa-users"></i><h3>Chưa có hồ sơ người dùng</h3><p>Hồ sơ sẽ được tạo tự động khi người dùng đăng nhập lại.</p></div>'; return; }
        usersGrid.innerHTML = '';
        users.forEach((user) => {
            const card = document.createElement('article');
            card.className = 'admin-user-card';
            const avatar = user.photoURL ? `<img src="${escapeHTML(user.photoURL)}" alt="">` : '<i class="fa-solid fa-user"></i>';
            card.innerHTML = `<div class="admin-user-head"><span class="admin-user-avatar">${avatar}</span><div><h3>${escapeHTML(user.displayName || 'Người học')}</h3><p>${escapeHTML(user.email || 'Không có email')}</p></div></div><dl><div><dt>Tham gia</dt><dd>${formatUserDate(user.joinedAt)}</dd></div><div><dt>Hoạt động gần nhất</dt><dd>${formatUserDate(user.lastActiveAt)}</dd></div></dl><button class="btn btn-outline admin-user-sets" type="button"><i class="fa-solid fa-layer-group"></i> Xem bộ thẻ</button><div class="admin-user-sets-list" hidden></div>`;
            const button = card.querySelector('.admin-user-sets');
            const list = card.querySelector('.admin-user-sets-list');
            button.addEventListener('click', async () => {
                if (!list.hidden) { list.hidden = true; button.innerHTML = '<i class="fa-solid fa-layer-group"></i> Xem bộ thẻ'; return; }
                button.disabled = true; button.innerHTML = brandButtonLoading('Đang tải...');
                try {
                    const setsSnapshot = await getDocs(query(collection(db, 'study_sets'), where('ownerId', '==', user.id)));
                    const sets = setsSnapshot.docs.map((setDoc) => setDoc.data());
                    list.innerHTML = sets.length ? sets.map((set) => `<p><strong>${escapeHTML(set.title || 'Chưa đặt tên')}</strong><span>${Array.isArray(set.words) ? set.words.length : 0} từ · ${escapeHTML(set.publicationStatus || 'private')}</span></p>`).join('') : '<p class="admin-user-no-sets">Người dùng này chưa có bộ thẻ.</p>';
                    list.hidden = false;
                } catch (error) { console.error('Không thể tải bộ thẻ của người dùng:', error); showError('Không thể tải bộ thẻ của người dùng.'); }
                finally { button.disabled = false; button.innerHTML = list.hidden ? '<i class="fa-solid fa-layer-group"></i> Xem bộ thẻ' : '<i class="fa-solid fa-layer-group"></i> Ẩn bộ thẻ'; }
            });
            usersGrid.append(card);
        });
    } catch (error) { console.error('Không thể tải danh sách người dùng:', error); usersGrid.innerHTML = '<div class="admin-empty"><i class="fa-solid fa-triangle-exclamation"></i><h3>Chưa thể tải người dùng</h3><p>Kiểm tra Firestore Rules rồi thử lại.</p></div>'; }
}

async function syncAdminAccess(user) {
    const adminLink = document.getElementById('btn-admin-panel');
    if (!user) {
        hasAdminAccess = false;
        if (adminLink) adminLink.hidden = true;
        if (currentPage === 'admin') renderAdminAccessState({ title: 'Cần đăng nhập', description: 'Hãy đăng nhập bằng tài khoản quản trị để xem hàng chờ xét duyệt.', action: '<a class="btn btn-black" href="/">Về trang chủ</a>' });
        return;
    }
    try {
        const adminSnapshot = await getDoc(doc(db, 'admins', user.uid));
        if (currentUser?.uid !== user.uid) return;
        hasAdminAccess = adminSnapshot.exists();
        if (adminLink) adminLink.hidden = !hasAdminAccess;
        if (currentPage === 'admin') {
            if (hasAdminAccess) {
                document.getElementById('admin-access-state')?.setAttribute('hidden', '');
                document.getElementById('admin-tabs')?.removeAttribute('hidden');
                loadAdminReviewQueue();
                loadAdminUsers();
            } else {
            renderAdminAccessState({ title: 'Bạn chưa có quyền quản trị', description: 'Tài khoản này không được phép kiểm duyệt bộ thẻ cộng đồng.', action: '<a class="btn btn-outline" href="/">Về trang chủ</a>' });
            }
        }
    } catch (error) {
        console.error('Không thể kiểm tra quyền admin:', error);
        hasAdminAccess = false;
        if (adminLink) adminLink.hidden = true;
        if (currentPage === 'admin') renderAdminAccessState({ title: 'Chưa thể xác thực quyền quản trị', description: 'Vui lòng kiểm tra Firestore Rules và thử lại.', action: '<a class="btn btn-outline" href="/">Về trang chủ</a>' }, 'fa-triangle-exclamation');
    }
}

// XÁC ĐỊNH XEM TRÌNH DUYỆT ĐANG MỞ FILE NÀO
const currentPage = document.body.getAttribute('data-page');

document.getElementById('admin-tabs')?.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-admin-tab]');
    if (!tab) return;
    const showUsers = tab.dataset.adminTab === 'users';
    document.querySelectorAll('[data-admin-tab]').forEach((button) => button.classList.toggle('is-active', button === tab));
    document.getElementById('admin-review-content').hidden = showUsers;
    document.getElementById('admin-users-content').hidden = !showUsers;
});

// ============ ERROR HANDLING & VALIDATION ========
let activeToast = null;
let activeToastTimer = null;

function dismissActiveToast(immediate = false) {
    if (!activeToast) return;
    if (activeToastTimer) clearTimeout(activeToastTimer);
    const toastToRemove = activeToast;
    activeToast = null;
    activeToastTimer = null;
    if (immediate) {
        toastToRemove.remove();
        return;
    }
    toastToRemove.style.opacity = '0';
    toastToRemove.style.transform = 'translateX(20px)';
    setTimeout(() => toastToRemove.remove(), 260);
}

function showToast(message, type = 'success', duration = 3000) {
    // Luôn chỉ giữ một thông báo để không che nội dung hoặc đè chữ lên nhau.
    dismissActiveToast(true);
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
    activeToast = toast;

    activeToastTimer = setTimeout(() => {
        if (activeToast !== toast) return;
        dismissActiveToast();
    }, duration);
}

function showSuccess(message) { showToast(message, 'success'); }
function showError(message) { showToast(message, 'error'); }

// Dữ liệu bộ thẻ do người dùng nhập có thể chứa ký tự HTML. Luôn escape trước
// khi đưa chúng vào template string dùng innerHTML.
function escapeHTML(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeSearchText(value = '') {
    return textValue(value).toLocaleLowerCase('vi-VN')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd');
}

function renderSearchResults(cards, hasSearchCriteria) {
    if (!searchResults) return;
    if (!hasSearchCriteria) {
        searchResults.innerHTML = '<p class="search-results-hint">Nhập tên bộ thẻ, mô tả hoặc tên tác giả để tìm nhanh.</p>';
        return;
    }
    if (!cards.length) {
        searchResults.innerHTML = '<div class="search-no-results"><i class="fa-solid fa-magnifying-glass"></i><p>Không tìm thấy bộ thẻ phù hợp.</p></div>';
        return;
    }

    searchResults.innerHTML = '';
    cards.slice(0, 8).forEach((card) => {
        const result = document.createElement('button');
        result.className = 'search-result-item';
        result.type = 'button';
        const title = card.querySelector('.set-title')?.textContent || 'Bộ thẻ chưa đặt tên';
        const description = card.querySelector('.set-lang')?.textContent?.trim() || 'Không có mô tả';
        result.innerHTML = `<span class="search-result-icon"><i class="fa-solid fa-layer-group"></i></span><span class="search-result-copy"><strong>${escapeHTML(title)}</strong><small>${escapeHTML(description)}</small></span><i class="fa-solid fa-arrow-right search-result-arrow"></i>`;
        result.addEventListener('click', () => {
            const id = card.dataset.setId;
            if (!id) return;
            navigateTo(`/study/?id=${encodeURIComponent(id)}`, 'Đang mở bộ thẻ');
        });
        searchResults.append(result);
    });
    if (cards.length > 8) {
        const more = document.createElement('p');
        more.className = 'search-results-more';
        more.textContent = `Hiển thị 8/${cards.length} kết quả. Hãy nhập thêm từ khóa để thu hẹp.`;
        searchResults.append(more);
    }
}

function applySetSearch() {
    if (!grid || !searchInput) return;
    const keyword = normalizeSearchText(searchInput.value);
    const selectedProgress = progressFilter?.value || 'all';
    const selectedVisibility = visibilityFilter?.value || 'all';
    const sortMode = setSort?.value || 'default';
    const cards = [...grid.querySelectorAll('.study-set-card')];
    const visibleCards = [];
    cards.forEach((card) => {
        const progress = Number(card.dataset.progress || 0);
        const matchesProgress = selectedProgress === 'all'
            || (selectedProgress === 'unstarted' && progress === 0)
            || (selectedProgress === 'in-progress' && progress > 0 && progress < 100)
            || (selectedProgress === 'completed' && progress >= 100);
        const matchesVisibility = selectedVisibility === 'all' || card.dataset.visibility === selectedVisibility;
        const matches = (!keyword || (card.dataset.search || '').includes(keyword)) && matchesProgress && matchesVisibility;
        card.hidden = !matches;
        if (matches) visibleCards.push(card);
    });
    const sorters = {
        'progress-desc': (a, b) => Number(b.dataset.progress || 0) - Number(a.dataset.progress || 0),
        'words-desc': (a, b) => Number(b.dataset.words || 0) - Number(a.dataset.words || 0),
        'title-asc': (a, b) => (a.dataset.title || '').localeCompare(b.dataset.title || '', 'vi')
    };
    if (sorters[sortMode]) cards.sort(sorters[sortMode]).forEach((card) => grid.appendChild(card));
    if (searchEmpty) {
        const hasActiveFilter = selectedProgress !== 'all' || selectedVisibility !== 'all';
        searchEmpty.hidden = true;
        renderSearchResults(visibleCards, Boolean(keyword) || hasActiveFilter);
    }
}

document.getElementById('btn-open-search')?.addEventListener('click', () => {
    if (!searchModal) return;
    searchModal.style.display = 'flex';
    applySetSearch();
    window.setTimeout(() => searchInput?.focus(), 0);
});
document.getElementById('btn-close-search')?.addEventListener('click', () => {
    if (searchModal) searchModal.style.display = 'none';
});
searchInput?.addEventListener('input', applySetSearch);
progressFilter?.addEventListener('change', applySetSearch);
visibilityFilter?.addEventListener('change', applySetSearch);
setSort?.addEventListener('change', applySetSearch);

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
    closeAccountDrawer();
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
        titleInput?.classList.add('is-invalid');
        showError('Vui lòng nhập tiêu đề bộ thẻ.');
        titleInput?.focus();
        return false;
    }
    titleInput?.classList.remove('is-invalid');

    let validCardCount = 0;
    let firstInvalidInput = null;

    for (const card of cardEls) {
        const term = card.querySelector('.input-term')?.value.trim();
        const def = card.querySelector('.input-def')?.value.trim();
        const allValues = [...card.querySelectorAll('input')].map((input) => input.value.trim());
        const isEmptyCard = allValues.every((value) => !value);

        card.querySelectorAll('.field-input').forEach(clearInputValidation);

        // Các thẻ mồi còn trống hoàn toàn không được lưu và cũng không báo lỗi.
        if (isEmptyCard) continue;

        if (!term) {
            const termInput = card.querySelector('.input-term');
            setInputValidation(termInput, 'Nhập thuật ngữ cho thẻ này.');
            firstInvalidInput ||= termInput;
        }

        if (!def) {
            const definitionInput = card.querySelector('.input-def');
            setInputValidation(definitionInput, term ? 'Thuật ngữ này cần có định nghĩa.' : 'Nhập định nghĩa cho thẻ này.');
            firstInvalidInput ||= definitionInput;
        }

        if (!term || !def) continue;
        validCardCount++;
    }

    if (firstInvalidInput) {
        showError('Hãy hoàn thiện các ô được đánh dấu đỏ trước khi lưu.');
        firstInvalidInput.focus();
        return false;
    }

    if (validCardCount === 0) {
        showError('Hãy thêm ít nhất một thẻ có thuật ngữ và định nghĩa.');
        return false;
    }

    return true;
}

function setInputValidation(input, message) {
    if (!input) return;
    const fieldGroup = input.closest('.field-group');
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
    fieldGroup?.classList.add('has-validation-error');

    if (!fieldGroup) return;
    let error = fieldGroup.querySelector('.field-error');
    if (!error) {
        error = document.createElement('small');
        error.className = 'field-error';
        error.setAttribute('role', 'alert');
        fieldGroup.append(error);
    }
    error.textContent = message;
}

function clearInputValidation(input) {
    if (!input) return;
    const fieldGroup = input.closest('.field-group');
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
    fieldGroup?.classList.remove('has-validation-error');
    fieldGroup?.querySelector('.field-error')?.remove();
}

function textValue(value) {
    return typeof value === 'string' ? value.trim() : (value == null ? '' : String(value).trim());
}

const VOCAB_LOOKUP_TIMEOUT_MS = 3500;
const TRANSLATION_LOOKUP_TIMEOUT_MS = 2500;
const vietnameseTranslationCache = new Map();

async function fetchWithTimeout(url, options = {}, timeoutMs = VOCAB_LOOKUP_TIMEOUT_MS) {
    const timeoutController = new AbortController();
    const parentSignal = options.signal;
    let timedOut = false;
    const abortFromParent = () => timeoutController.abort();

    if (parentSignal?.aborted) timeoutController.abort();
    else parentSignal?.addEventListener('abort', abortFromParent, { once: true });

    const timeoutId = window.setTimeout(() => {
        timedOut = true;
        timeoutController.abort();
    }, timeoutMs);

    try {
        return await fetch(url, { ...options, signal: timeoutController.signal });
    } catch (error) {
        if (timedOut) {
            const timeoutError = new Error(`Lookup timed out after ${timeoutMs}ms`);
            timeoutError.name = 'TimeoutError';
            throw timeoutError;
        }
        throw error;
    } finally {
        window.clearTimeout(timeoutId);
        parentSignal?.removeEventListener('abort', abortFromParent);
    }
}

function decodeLookupText(value) {
    const decoder = document.createElement('textarea');
    decoder.innerHTML = value == null ? '' : String(value);
    return textValue(decoder.value);
}

async function fetchVietnameseTranslation(word, signal) {
    const cacheKey = textValue(word).toLocaleLowerCase('en');
    if (vietnameseTranslationCache.has(cacheKey)) return vietnameseTranslationCache.get(cacheKey);

    try {
        const response = await fetchWithTimeout(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en%7Cvi`,
            { signal },
            TRANSLATION_LOOKUP_TIMEOUT_MS
        );
        if (!response.ok) throw new Error(`MyMemory HTTP ${response.status}`);
        const data = await response.json();
        const definition = decodeLookupText(data?.responseData?.translatedText);
        if (data?.responseStatus === 200 && definition) {
            const result = { definition, googleData: null };
            vietnameseTranslationCache.set(cacheKey, result);
            return result;
        }
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        console.warn('Nguồn dịch tiếng Việt không phản hồi, đang thử nguồn dự phòng:', error);
    }

    try {
        const response = await fetchWithTimeout(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dt=bd&q=${encodeURIComponent(word)}`,
            { signal },
            TRANSLATION_LOOKUP_TIMEOUT_MS
        );
        if (!response.ok) throw new Error(`Google Translate HTTP ${response.status}`);
        const googleData = await response.json();
        const definition = googleData?.[0]?.map((part) => part?.[0]).filter(Boolean).join('') || '';
        if (definition) {
            const result = { definition, googleData };
            vietnameseTranslationCache.set(cacheKey, result);
            return result;
        }
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        console.warn('Nguồn dịch dự phòng không phản hồi:', error);
    }

    return { definition: '', googleData: null };
}

// Chấp nhận cả dữ liệu cũ (def/meaning/word) để bộ thẻ tạo từ các phiên bản trước vẫn học được.
function normalizeVocabularyWord(word) {
    if (!word || typeof word !== 'object') return null;
    const term = textValue(word.term || word.word || word.front || word.english || word.en);
    const definition = textValue(word.definition || word.def || word.meaning || word.mean || word.translation || word.back || word.vietnamese || word.vi);
    if (!term || !definition) return null;

    return {
        term,
        definition,
        pronunciation: textValue(word.pronunciation || word.pron || word.phonetic),
        type: textValue(word.type || word.partOfSpeech),
        example: textValue(word.example || word.exampleSentence),
        synonyms: textValue(word.synonyms)
    };
}

function normalizeVocabularyWords(words) {
    return Array.isArray(words) ? words.map(normalizeVocabularyWord).filter(Boolean) : [];
}

// ============ THÊM TỪ NHANH TRÊN MỌI MÀN HÌNH ============
const QUICK_ADD_LAST_SET_KEY = 'supervocab:quick-add:last-set';
const quickAddSetCache = new Map();
let quickAddLookupController = null;
let quickAddLookupTimer = null;
let quickAddLookupInFlightWord = '';
let quickAddLastLookupWord = '';

const quickAddModal = document.createElement('div');
quickAddModal.id = 'quick-add-modal';
quickAddModal.className = 'modal-overlay quick-add-modal';
quickAddModal.style.display = 'none';
quickAddModal.setAttribute('role', 'dialog');
quickAddModal.setAttribute('aria-modal', 'true');
quickAddModal.setAttribute('aria-labelledby', 'quick-add-title');
quickAddModal.innerHTML = `
    <div class="modal-content quick-add-modal-content">
        <div class="modal-header">
            <div><p class="guide-eyebrow">Ghi lại ngay khi gặp</p><h3 id="quick-add-title">Thêm từ nhanh</h3></div>
            <button id="btn-close-quick-add" class="close-btn" type="button" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p class="quick-add-intro">Nhập thuật ngữ, SuperVocab sẽ tự tìm thông tin. Bạn có thể sửa trước khi lưu.</p>
        <form id="quick-add-form">
            <input id="quick-add-set" type="hidden">
            <p id="quick-add-destination" class="quick-add-destination"><i class="fa-solid fa-layer-group"></i><span>Đang xác định bộ thẻ…</span></p>
            <div class="quick-add-grid">
                <label class="quick-add-field">Thuật ngữ
                    <input id="quick-add-term" type="text" placeholder="VD: serendipity" autocomplete="off" required>
                </label>
                <label class="quick-add-field">Định nghĩa
                    <input id="quick-add-definition" type="text" placeholder="Nghĩa tiếng Việt" required>
                </label>
            </div>
            <div id="quick-add-definition-suggestions" class="quick-add-definition-suggestions" hidden aria-live="polite"></div>
            <p id="quick-add-status" class="quick-add-status" aria-live="polite"></p>
            <details class="quick-add-details">
                <summary>Thông tin bổ sung <span>Tùy chọn</span></summary>
                <div class="quick-add-grid">
                    <label class="quick-add-field">Phát âm<input id="quick-add-pronunciation" type="text"></label>
                    <label class="quick-add-field">Loại từ<input id="quick-add-type" type="text"></label>
                    <label class="quick-add-field quick-add-field-wide">Ví dụ<input id="quick-add-example" type="text"></label>
                    <label class="quick-add-field quick-add-field-wide">Từ đồng nghĩa<input id="quick-add-synonyms" type="text"></label>
                </div>
            </details>
            <div class="quick-add-footer">
                <span class="quick-add-shortcut"><kbd>Ctrl</kbd> + <kbd>K</kbd> hoặc <kbd>N</kbd></span>
                <button id="btn-save-quick-add" class="btn btn-black" type="submit"><i class="fa-solid fa-plus"></i> Thêm vào bộ thẻ</button>
            </div>
        </form>
    </div>`;
document.body.appendChild(quickAddModal);

const quickAddForm = document.getElementById('quick-add-form');
const quickAddSetInput = document.getElementById('quick-add-set');
const quickAddDestination = document.getElementById('quick-add-destination');
const quickAddTermInput = document.getElementById('quick-add-term');
const quickAddDefinitionInput = document.getElementById('quick-add-definition');
const quickAddSuggestions = document.getElementById('quick-add-definition-suggestions');
const quickAddStatus = document.getElementById('quick-add-status');
const quickAddFields = {
    definition: quickAddDefinitionInput,
    pronunciation: document.getElementById('quick-add-pronunciation'),
    type: document.getElementById('quick-add-type'),
    example: document.getElementById('quick-add-example'),
    synonyms: document.getElementById('quick-add-synonyms')
};

function setQuickAddStatus(message = '', state = '') {
    quickAddStatus.textContent = message;
    quickAddStatus.dataset.state = state;
}

function quickTermKey(value) {
    return textValue(value).normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

function setQuickAutoValue(input, value, word) {
    if (!input || !value || (input.value && !input.dataset.autoFilledFor)) return;
    input.value = value;
    input.dataset.autoFilledFor = word;
}

function clearQuickAutoValues(nextWord = '') {
    Object.values(quickAddFields).forEach((input) => {
        if (!input?.dataset.autoFilledFor || input.dataset.autoFilledFor === nextWord) return;
        input.value = '';
        delete input.dataset.autoFilledFor;
    });
}

function getQuickDuplicate(setId, term) {
    const setData = quickAddSetCache.get(setId);
    const termKey = quickTermKey(term);
    if (!setData || !termKey) return null;
    return normalizeVocabularyWords(setData.words).find((word) => quickTermKey(word.term) === termKey) || null;
}

function showQuickDuplicateIfNeeded() {
    const duplicate = getQuickDuplicate(quickAddSetInput.value, quickAddTermInput.value);
    if (!duplicate) return false;
    const setTitle = quickAddSetCache.get(quickAddSetInput.value)?.title || 'bộ thẻ này';
    setQuickAddStatus(`Từ “${duplicate.term}” đã tồn tại trong “${setTitle}”.`, 'error');
    return true;
}

async function loadQuickAddSet(preferredSetId = '') {
    quickAddSetCache.clear();
    if (!currentUser) {
        quickAddSetInput.value = '';
        return false;
    }
    const rememberedSet = localStorage.getItem(`${QUICK_ADD_LAST_SET_KEY}:${currentUser.uid}`) || '';
    const setId = preferredSetId || rememberedSet;
    if (!setId) return false;
    quickAddDestination.querySelector('span').textContent = 'Đang tải bộ thẻ…';
    try {
        const snapshot = await getDoc(doc(db, 'study_sets', setId));
        if (!snapshot.exists() || snapshot.data().ownerId !== currentUser.uid) throw new Error('SET_NOT_FOUND');
        const setData = { id: snapshot.id, ...snapshot.data() };
        quickAddSetCache.set(setId, setData);
        quickAddSetInput.value = setId;
        const count = normalizeVocabularyWords(setData.words).length;
        const reviewNote = setData.isPublic || setData.publicationStatus === 'approved' ? ' · sẽ gửi duyệt lại' : '';
        quickAddDestination.querySelector('span').textContent = `${setData.title || 'Chưa đặt tên'} · ${count} từ${reviewNote}`;
        setQuickAddStatus('Nhập thuật ngữ để tự động tra nghĩa.', '');
        return true;
    } catch (error) {
        console.error('Không thể tải bộ thẻ để thêm nhanh:', error);
        quickAddSetInput.value = '';
        setQuickAddStatus('Không thể tải bộ thẻ này. Vui lòng thử lại.', 'error');
        return false;
    }
}

const quickSenseTranslationCache = new Map();
const emptyQuickDetails = () => ({ pronunciation: '', type: '', example: '', synonyms: '' });
const quickDetailCount = (details) => Object.values(details).filter(Boolean).length;
const waitForQuickLookupRetry = () => new Promise((resolve) => window.setTimeout(resolve, 400));

function quickDictionaryDetails(entries) {
    const entry = entries?.[0] || {};
    const meaning = entry.meanings?.find((item) => item.definitions?.some((definition) => definition.example) || item.synonyms?.length) || entry.meanings?.[0] || {};
    const definition = meaning.definitions?.find((item) => item.example) || meaning.definitions?.[0] || {};
    return {
        pronunciation: entry.phonetic || entry.phonetics?.find((item) => item.text)?.text || '',
        type: meaning.partOfSpeech || '',
        example: definition.example || '',
        synonyms: [...new Set([...(meaning.synonyms || []), ...(definition.synonyms || [])])].slice(0, 3).join(', ')
    };
}

function quickDictionaryDetailsByPart(entries) {
    const detailsByPart = {};
    (entries || []).forEach((entry) => {
        const pronunciation = entry.phonetic || entry.phonetics?.find((item) => item.text)?.text || '';
        (entry.meanings || []).forEach((meaning) => {
            const key = textValue(meaning.partOfSpeech).toLowerCase();
            if (!key) return;
            const definition = meaning.definitions?.find((item) => item.example) || meaning.definitions?.[0] || {};
            const candidate = {
                pronunciation,
                type: meaning.partOfSpeech || '',
                example: definition.example || '',
                synonyms: [...new Set([...(meaning.synonyms || []), ...(definition.synonyms || [])])].slice(0, 3).join(', ')
            };
            if (!detailsByPart[key] || quickDetailCount(candidate) > quickDetailCount(detailsByPart[key])) detailsByPart[key] = candidate;
        });
    });
    return detailsByPart;
}

function quickDictionarySenses(entries) {
    return (entries || []).flatMap((entry) => {
        const pronunciation = entry.phonetic || entry.phonetics?.find((item) => item.text)?.text || '';
        return (entry.meanings || []).flatMap((meaning) => (meaning.definitions || []).map((definition) => ({
            pronunciation,
            type: textValue(meaning.partOfSpeech),
            sourceDefinition: textValue(definition.definition),
            example: textValue(definition.example),
            synonyms: [...new Set([...(meaning.synonyms || []), ...(definition.synonyms || [])])].slice(0, 3).join(', ')
        }))).filter((sense) => sense.sourceDefinition);
    });
}

function quickTranslationSuggestions(translationData, fallback = '') {
    const suggestions = [];
    const partLabels = { verb: 'v', noun: 'n', adjective: 'adj', adverb: 'adv', pronoun: 'pron', preposition: 'prep', conjunction: 'conj', interjection: 'interj' };
    (Array.isArray(translationData?.[1]) ? translationData[1] : []).forEach((group) => {
        const partOfSpeech = textValue(group?.[0]);
        const shortPart = partLabels[partOfSpeech.toLowerCase()] || partOfSpeech;
        (Array.isArray(group?.[1]) ? group[1] : []).forEach((candidate) => {
            const value = textValue(Array.isArray(candidate) ? candidate[0] : candidate);
            if (value) suggestions.push({ value, label: shortPart ? `${value} · ${shortPart}` : value, partOfSpeech });
        });
    });
    if (fallback) suggestions.unshift({ value: fallback, label: fallback, partOfSpeech: '' });
    return suggestions;
}

async function fetchQuickDictionary(word, signal, maxAttempts = 1) {
    let bestEntries = [];
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await fetchWithTimeout(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal });
            if (response.status === 404) return { entries: [], notFound: true };
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const entries = await response.json();
            if (quickDetailCount(quickDictionaryDetails(entries)) > quickDetailCount(quickDictionaryDetails(bestEntries))) bestEntries = entries;
            if (quickDetailCount(quickDictionaryDetails(bestEntries)) >= 2) break;
        } catch (error) {
            if (error.name === 'AbortError') throw error;
        }
        if (attempt < maxAttempts - 1) await waitForQuickLookupRetry();
    }
    return { entries: bestEntries, notFound: false };
}

async function fetchQuickTranslation(word, signal) {
    const result = await fetchVietnameseTranslation(word, signal);
    return {
        definition: result.definition,
        suggestions: result.googleData
            ? quickTranslationSuggestions(result.googleData, result.definition)
            : (result.definition ? [{ value: result.definition, label: result.definition, partOfSpeech: '' }] : [])
    };
}

function normalizeQuickMeaning(value) {
    return textValue(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

async function translateQuickSenses(word, senses) {
    const cacheKey = `${quickTermKey(word)}|${senses.map((sense) => `${sense.type}:${sense.sourceDefinition}`).join('\u001f')}`;
    if (quickSenseTranslationCache.has(cacheKey)) return quickSenseTranslationCache.get(cacheKey);
    const task = (async () => {
        const requestText = senses.map((sense, index) => `${sense.sourceDefinition}\n@@SENSE_${index}@@`).join('\n');
        const response = await fetchWithTimeout(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(requestText)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const translated = Array(senses.length).fill('');
        let currentIndex = 0;
        (data?.[0] || []).forEach((part) => {
            const source = textValue(part?.[1]);
            const marker = source.match(/@@SENSE_(\d+)@@/);
            if (marker) currentIndex = Number(marker[1]) + 1;
            else if (currentIndex < translated.length) translated[currentIndex] += textValue(part?.[0]);
        });
        return senses.map((sense, index) => ({ ...sense, translatedDefinition: translated[index] }));
    })();
    quickSenseTranslationCache.set(cacheKey, task);
    try { return await task; }
    catch (error) { quickSenseTranslationCache.delete(cacheKey); throw error; }
}

async function findQuickDetailsForMeaning(word, selectedMeaning, partOfSpeech, senses) {
    const candidates = senses.filter((sense) => !partOfSpeech || sense.type.toLowerCase() === partOfSpeech.toLowerCase());
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];
    const selectedText = normalizeQuickMeaning(selectedMeaning);
    const selectedTokens = selectedText.split(' ').filter((token) => token.length > 1);
    const translatedSenses = await translateQuickSenses(word, candidates);
    const ranked = translatedSenses.map((sense) => {
        const translatedText = normalizeQuickMeaning(sense.translatedDefinition);
        return { sense, score: (selectedText && translatedText.includes(selectedText) ? 20 : 0) + selectedTokens.filter((token) => translatedText.includes(token)).length };
    }).sort((left, right) => right.score - left.score);
    return ranked[0]?.score > 0 ? ranked[0].sense : null;
}

function replaceQuickValue(input, value, word) {
    input.value = value || '';
    if (value) input.dataset.autoFilledFor = word;
    else delete input.dataset.autoFilledFor;
}

function renderQuickMeaningSuggestions(suggestions, word, detailsByPart, fallbackDetails, senses, activeDefinition) {
    const unique = [];
    const seen = new Set();
    suggestions.forEach((suggestion) => {
        const value = textValue(suggestion.value || suggestion).replace(/\s+/g, ' ').normalize('NFC');
        const key = value.toLocaleLowerCase('vi');
        if (!value || seen.has(key)) return;
        seen.add(key);
        unique.push({ value, label: textValue(suggestion.label) || value, partOfSpeech: textValue(suggestion.partOfSpeech).toLowerCase() });
    });
    quickAddSuggestions.replaceChildren();
    if (unique.length < 2) {
        quickAddSuggestions.hidden = true;
        return;
    }
    const title = document.createElement('span');
    title.className = 'quick-add-suggestions-title';
    title.innerHTML = '<i class="fa-solid fa-list-check"></i> Chọn nghĩa phù hợp';
    const choices = document.createElement('div');
    choices.className = 'quick-add-suggestion-options';
    unique.slice(0, 6).forEach(({ value, label, partOfSpeech }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quick-add-suggestion-option';
        button.textContent = label;
        button.classList.toggle('is-selected', quickTermKey(value) === quickTermKey(activeDefinition));
        button.addEventListener('click', async () => {
            replaceQuickValue(quickAddDefinitionInput, value, word);
            choices.querySelectorAll('button').forEach((option) => option.classList.toggle('is-selected', option === button));
            ['pronunciation', 'type', 'example', 'synonyms'].forEach((key) => replaceQuickValue(quickAddFields[key], '', word));
            setQuickAddStatus(`Đang cập nhật thông tin cho nghĩa “${value}”…`, 'loading');
            try {
                const matched = await findQuickDetailsForMeaning(word, value, partOfSpeech, senses);
                if (quickAddTermInput.value.trim() !== word || quickAddDefinitionInput.value !== value) return;
                const selected = matched || detailsByPart[partOfSpeech] || fallbackDetails;
                ['pronunciation', 'type', 'example', 'synonyms'].forEach((key) => replaceQuickValue(quickAddFields[key], selected?.[key], word));
                setQuickAddStatus(matched
                    ? `Đã chọn nghĩa “${value}” và cập nhật thông tin liên quan.`
                    : `Đã chọn nghĩa “${value}”. Một số thông tin riêng cho nghĩa này chưa có.`, matched ? 'success' : 'error');
            } catch (error) {
                console.warn('Không thể ghép dữ liệu theo nghĩa đã chọn:', error);
                setQuickAddStatus(`Đã chọn nghĩa “${value}”, nhưng chưa thể cập nhật dữ liệu liên quan.`, 'error');
            }
        });
        choices.appendChild(button);
    });
    quickAddSuggestions.append(title, choices);
    quickAddSuggestions.hidden = false;
}

async function lookupQuickWord() {
    const word = quickAddTermInput.value.trim();
    if (!word || showQuickDuplicateIfNeeded()) return;
    if (quickAddLookupInFlightWord === word || quickAddLastLookupWord === word) return;
    quickAddLookupController?.abort();
    const controller = new AbortController();
    quickAddLookupController = controller;
    quickAddLookupInFlightWord = word;
    clearQuickAutoValues(word);
    quickAddSuggestions.hidden = true;
    setQuickAddStatus('Đang tìm nhiều nghĩa và thông tin từ…', 'loading');

    try {
        const [dictionaryLookup, translationLookup] = await Promise.all([
            fetchQuickDictionary(word, controller.signal),
            fetchQuickTranslation(word, controller.signal)
        ]);
        if (controller.signal.aborted || quickAddTermInput.value.trim() !== word) return;
        const details = quickDictionaryDetails(dictionaryLookup.entries);
        const detailsByPart = quickDictionaryDetailsByPart(dictionaryLookup.entries);
        const senses = quickDictionarySenses(dictionaryLookup.entries);
        const values = { definition: translationLookup.definition, ...details };
        Object.entries(values).forEach(([key, value]) => setQuickAutoValue(quickAddFields[key], value, word));
        renderQuickMeaningSuggestions(translationLookup.suggestions, word, detailsByPart, details, senses, translationLookup.definition);
        quickAddLastLookupWord = word;
        const foundCount = Object.values(values).filter(Boolean).length;
        if (translationLookup.suggestions.length > 1) {
            setQuickAddStatus(`Tìm thấy ${translationLookup.suggestions.length} nghĩa. Hãy chọn nghĩa phù hợp bên dưới.`, 'success');
        } else if (foundCount) {
            setQuickAddStatus(`Đã tự động điền ${foundCount}/5 mục. Bạn có thể chỉnh sửa trước khi lưu.`, 'success');
        } else if (dictionaryLookup.notFound) {
            setQuickAddStatus('Không nhận diện được từ. Hãy kiểm tra chính tả hoặc nhập thủ công.', 'error');
        } else setQuickAddStatus('Không tìm thấy dữ liệu. Bạn vẫn có thể nhập thủ công.', 'error');
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.warn('Không thể tra từ nhanh:', error);
        setQuickAddStatus('Không thể tra từ lúc này. Bạn vẫn có thể nhập thủ công.', 'error');
    } finally {
        if (quickAddLookupInFlightWord === word) quickAddLookupInFlightWord = '';
    }
}

async function openQuickAdd(preferredSetId = '') {
    if (!currentUser) {
        showError('Hãy đăng nhập để thêm từ vào thư viện cá nhân.');
        await startGoogleSignIn();
        if (!auth.currentUser) return;
        currentUser = auth.currentUser;
    }
    const targetSetId = preferredSetId || localStorage.getItem(`${QUICK_ADD_LAST_SET_KEY}:${currentUser.uid}`) || '';
    if (!targetSetId) return showError('Hãy bấm “Thêm từ” trên bộ thẻ bạn muốn bổ sung.');
    document.querySelectorAll('.modal-overlay').forEach((modal) => { modal.style.display = 'none'; });
    quickAddModal.style.display = 'flex';
    const loaded = await loadQuickAddSet(targetSetId);
    if (!loaded) return;
    window.setTimeout(() => quickAddTermInput.focus(), 0);
}

function closeQuickAdd() {
    quickAddLookupController?.abort();
    quickAddModal.style.display = 'none';
}

document.getElementById('btn-close-quick-add').addEventListener('click', closeQuickAdd);
quickAddModal.addEventListener('click', (event) => { if (event.target === quickAddModal) closeQuickAdd(); });

quickAddTermInput.addEventListener('input', () => {
    clearTimeout(quickAddLookupTimer);
    quickAddLookupController?.abort();
    clearQuickAutoValues(quickAddTermInput.value.trim());
    quickAddLastLookupWord = '';
    quickAddSuggestions.replaceChildren();
    quickAddSuggestions.hidden = true;
    if (!quickAddTermInput.value.trim()) return setQuickAddStatus('Nhập thuật ngữ để tự động tra nghĩa.', '');
    if (showQuickDuplicateIfNeeded()) return;
    setQuickAddStatus('Sẽ tự động tra sau khi bạn dừng nhập…', '');
    quickAddLookupTimer = window.setTimeout(lookupQuickWord, 450);
});
quickAddTermInput.addEventListener('blur', () => {
    clearTimeout(quickAddLookupTimer);
    if (quickAddTermInput.value.trim() && !showQuickDuplicateIfNeeded()) lookupQuickWord();
});
Object.values(quickAddFields).forEach((input) => input?.addEventListener('input', () => delete input.dataset.autoFilledFor));

quickAddForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const setId = quickAddSetInput.value;
    const word = normalizeVocabularyWord({
        term: quickAddTermInput.value,
        definition: quickAddDefinitionInput.value,
        pronunciation: quickAddFields.pronunciation.value,
        type: quickAddFields.type.value,
        example: quickAddFields.example.value,
        synonyms: quickAddFields.synonyms.value
    });
    if (!currentUser) return showError('Hãy đăng nhập để thêm từ.');
    if (!setId) return setQuickAddStatus('Hãy chọn một bộ thẻ.', 'error');
    if (!word) return setQuickAddStatus('Thuật ngữ và định nghĩa là hai mục bắt buộc.', 'error');
    if (showQuickDuplicateIfNeeded()) return quickAddTermInput.focus();

    const saveButton = document.getElementById('btn-save-quick-add');
    saveButton.disabled = true;
    saveButton.innerHTML = brandButtonLoading('Đang thêm…');
    try {
        const setRef = doc(db, 'study_sets', setId);
        const updatedSet = await runTransaction(db, async (transaction) => {
            const snapshot = await transaction.get(setRef);
            if (!snapshot.exists()) throw new Error('SET_NOT_FOUND');
            const setData = snapshot.data();
            if (setData.ownerId !== currentUser.uid) throw new Error('NOT_OWNER');
            const words = normalizeVocabularyWords(setData.words);
            if (words.some((existingWord) => quickTermKey(existingWord.term) === quickTermKey(word.term))) {
                throw new Error('DUPLICATE_WORD');
            }
            const needsReview = setData.isPublic === true || ['approved', 'pending'].includes(setData.publicationStatus);
            // Luôn chuẩn hóa hai trường xuất bản để cả các bộ thẻ cũ cũng thỏa Firestore Rules hiện tại.
            const updateData = {
                words: [...words, word],
                isPublic: false,
                publicationStatus: needsReview ? 'pending' : 'private'
            };
            transaction.update(setRef, updateData);
            return { ...setData, ...updateData };
        });
        quickAddSetCache.set(setId, { id: setId, ...updatedSet });
        localStorage.setItem(`${QUICK_ADD_LAST_SET_KEY}:${currentUser.uid}`, setId);
        closeQuickAdd();
        quickAddForm.reset();
        quickAddLastLookupWord = '';
        quickAddSuggestions.replaceChildren();
        quickAddSuggestions.hidden = true;
        Object.values(quickAddFields).forEach((input) => delete input.dataset.autoFilledFor);
        showSuccess(`Đã thêm “${word.term}” vào “${updatedSet.title || 'bộ thẻ'}”.`);
        if (currentPage === 'home') loadSets('home-personal');
        if (currentPage === 'created') loadSets('created');
    } catch (error) {
        if (error.message === 'DUPLICATE_WORD') {
            setQuickAddStatus(`Từ “${word.term}” đã tồn tại trong bộ thẻ này.`, 'error');
            quickAddTermInput.focus();
        } else if (error.message === 'SET_NOT_FOUND') setQuickAddStatus('Bộ thẻ này không còn tồn tại.', 'error');
        else if (error.message === 'NOT_OWNER') setQuickAddStatus('Bạn không có quyền sửa bộ thẻ này.', 'error');
        else {
            console.error('Không thể thêm từ nhanh:', error);
            handleFirebaseError(error);
        }
    } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fa-solid fa-plus"></i> Thêm vào bộ thẻ';
    }
});

document.addEventListener('keydown', (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable);
    const isQuickShortcut = (event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase('en') === 'k';
    const isNShortcut = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLocaleLowerCase('en') === 'n' && !isTyping;
    if (!isQuickShortcut && !isNShortcut) return;
    event.preventDefault();
    if (quickAddModal.style.display === 'flex') quickAddTermInput.focus();
    else openQuickAdd();
});

// ============ MỤC TIÊU VÀ NHỊP HỌC HẰNG NGÀY ============
function getLocalDayKey(date = new Date()) {
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 10);
}

function getDailyGoal(userId) {
    const rawGoal = Number(localStorage.getItem(`daily_goal_${userId}`));
    return [10, 15, 20, 30].includes(rawGoal) ? rawGoal : 15;
}

function setDailyGoal(userId, goal) {
    localStorage.setItem(`daily_goal_${userId}`, String(goal));
    const todayKey = `words_today_${userId}_${new Date().toDateString()}`;
    const todayData = JSON.parse(localStorage.getItem(todayKey) || '{"count":0}');
    todayData.max = goal;
    localStorage.setItem(todayKey, JSON.stringify(todayData));
    renderLearningInsights(userId);
}

function getLearningActivity(userId) {
    try { return JSON.parse(localStorage.getItem(`learning_activity_${userId}`) || '{}'); }
    catch { return {}; }
}

function recordLearningActivity(userId, type = 'processed') {
    if (!userId) return;
    const allActivity = getLearningActivity(userId);
    const dayKey = getLocalDayKey();
    const dayActivity = allActivity[dayKey] || { processed: 0, reviewed: 0, quizCorrect: 0, quizTotal: 0 };
    if (type === 'quiz-correct') { dayActivity.quizCorrect += 1; dayActivity.quizTotal += 1; }
    else if (type === 'quiz-wrong') dayActivity.quizTotal += 1;
    else {
        dayActivity.processed += 1;
        if (type === 'reviewed') dayActivity.reviewed += 1;
    }
    allActivity[dayKey] = dayActivity;
    const retainedKeys = Object.keys(allActivity).sort().slice(-90);
    const retainedActivity = Object.fromEntries(retainedKeys.map((key) => [key, allActivity[key]]));
    localStorage.setItem(`learning_activity_${userId}`, JSON.stringify(retainedActivity));
    if (currentPage === 'home') renderLearningInsights(userId);
}

function getTodayWordsCount(userId) {
    try {
        const today = new Date().toDateString();
        const key = `words_today_${userId}_${today}`;
        const saved = JSON.parse(localStorage.getItem(key) || '{"count":0}');
        return { count: Number(saved.count) || 0, max: getDailyGoal(userId) };
    } catch {
        return { count: 0, max: 15 };
    }
}

function recordWordStudied(userId) {
    const today = new Date().toDateString();
    const key = `words_today_${userId}_${today}`;
    const data = getTodayWordsCount(userId);
    
    data.count += 1;
    data.max = getDailyGoal(userId);
    localStorage.setItem(key, JSON.stringify(data));
    recordLearningActivity(userId, 'processed');
    updateTodayWordsDisplay(userId);
}

function updateTodayWordsDisplay(userId) {
    const counter = document.getElementById('today-words-count');
    if (!counter) return;
    
    const data = getTodayWordsCount(userId);
    counter.textContent = `${data.count}/${data.max}`;
}

function getLearningStreak(userId) {
    const activity = getLearningActivity(userId);
    let streak = 0;
    const cursor = new Date();
    for (let offset = 0; offset < 365; offset++) {
        const key = getLocalDayKey(cursor);
        const day = activity[key];
        if (day && (day.processed > 0 || day.quizTotal > 0)) streak += 1;
        else break;
        cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
}

function renderLearningInsights(userId) {
    const goalData = getTodayWordsCount(userId);
    const current = goalData.count;
    const target = goalData.max;
    const progress = Math.min(100, Math.round((current / target) * 100));
    const activity = getLearningActivity(userId)[getLocalDayKey()] || {};
    const goalCurrent = document.getElementById('daily-goal-current');
    const goalTarget = document.getElementById('daily-goal-target');
    const goalFill = document.getElementById('daily-goal-fill');
    const goalTrack = document.querySelector('.daily-goal-track');
    const goalStatus = document.getElementById('daily-goal-status');
    if (goalCurrent) goalCurrent.textContent = current;
    if (goalTarget) goalTarget.textContent = target;
    if (goalFill) goalFill.style.width = `${progress}%`;
    if (goalTrack) { goalTrack.setAttribute('aria-valuemax', String(target)); goalTrack.setAttribute('aria-valuenow', String(current)); }
    if (goalStatus) goalStatus.textContent = current >= target ? 'Hoàn thành mục tiêu hôm nay!' : `Còn ${target - current} thẻ để hoàn thành`;
    const streakElement = document.getElementById('study-streak-count');
    const processedElement = document.getElementById('today-processed-count');
    if (streakElement) streakElement.textContent = `${getLearningStreak(userId)} ngày`;
    if (processedElement) processedElement.textContent = `${activity.processed || 0} thẻ`;
    document.querySelectorAll('.daily-goal-choices [data-goal]').forEach((button) => {
        button.classList.toggle('is-active', Number(button.dataset.goal) === target);
    });
    const weekBars = document.getElementById('learning-week-bars');
    if (weekBars) {
        const allActivity = getLearningActivity(userId);
        const week = [];
        for (let offset = 6; offset >= 0; offset--) {
            const date = new Date(); date.setDate(date.getDate() - offset);
            const day = allActivity[getLocalDayKey(date)] || {};
            week.push({ label: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()], count: (day.processed || 0) + (day.quizTotal || 0), today: offset === 0 });
        }
        const max = Math.max(...week.map((day) => day.count), 1);
        weekBars.innerHTML = '';
        week.forEach((day) => {
            const column = document.createElement('div');
            column.className = `learning-week-bar${day.today ? ' is-today' : ''}`;
            const bar = document.createElement('span');
            bar.style.height = `${Math.max(4, Math.round((day.count / max) * 44))}px`;
            bar.title = `${day.count} thẻ đã xử lý`;
            const label = document.createElement('small'); label.textContent = day.label;
            column.append(bar, label); weekBars.appendChild(column);
        });
    }
}

if (currentPage === 'home') {
    const dailyGoalModal = document.getElementById('daily-goal-modal');
    const closeDailyGoalModal = () => { if (dailyGoalModal) dailyGoalModal.style.display = 'none'; };
    document.getElementById('btn-edit-daily-goal')?.addEventListener('click', () => {
        if (!currentUser) return showError('Hãy đăng nhập để đặt mục tiêu học.');
        dailyGoalModal.style.display = 'flex';
    });
    document.getElementById('btn-close-daily-goal')?.addEventListener('click', closeDailyGoalModal);
    document.querySelectorAll('.daily-goal-choices [data-goal]').forEach((button) => {
        button.addEventListener('click', () => {
            if (!currentUser) return;
            setDailyGoal(currentUser.uid, Number(button.dataset.goal));
            closeDailyGoalModal();
            showToast('Đã cập nhật mục tiêu học hằng ngày.', 'success');
        });
    });
}



// ============ RESPONSIVE: HAMBURGER MENU ============
const hamburgerBtn = document.getElementById('hamburger-toggle');
const sidebar = document.querySelector('.sidebar-left');

if (hamburgerBtn && sidebar) {
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    const sidebarOverlay = document.createElement('button');
    sidebarOverlay.type = 'button';
    sidebarOverlay.className = 'sidebar-overlay';
    sidebarOverlay.setAttribute('aria-label', 'Đóng bảng hoạt động học tập');
    sidebarOverlay.tabIndex = -1;
    document.body.append(sidebarOverlay);

    const sidebarCloseBtn = document.createElement('button');
    sidebarCloseBtn.type = 'button';
    sidebarCloseBtn.className = 'sidebar-close-btn';
    sidebarCloseBtn.setAttribute('aria-label', 'Đóng bảng hoạt động học tập');
    sidebarCloseBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    sidebar.prepend(sidebarCloseBtn);

    const setSidebarOpen = (isOpen) => {
        sidebar.classList.toggle('active', isOpen);
        sidebarOverlay.classList.toggle('active', isOpen);
        document.body.classList.toggle('sidebar-open', isOpen);
        hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
    };

    hamburgerBtn.addEventListener('click', () => {
        setSidebarOpen(!sidebar.classList.contains('active'));
    });

    sidebarOverlay.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setSidebarOpen(false);
    });
    sidebarCloseBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setSidebarOpen(false);
    });

    // Close sidebar when clicking on nav links
    document.querySelectorAll('.nav-btn').forEach(link => {
        link.addEventListener('click', () => {
            setSidebarOpen(false);
        });
    });

    // Fallback khi thao tác ngoài panel trên màn hình lớn.
    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !hamburgerBtn.contains(e.target)) {
            setSidebarOpen(false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setSidebarOpen(false);
    });
} 

// 1. XỬ LÝ ĐĂNG NHẬP / ĐĂNG XUẤT (Bản an toàn)
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        ensureUserProfile(user);
        
        // KIỂM TRA BẢO VỆ: Có nút avatar thì mới đổi hình
        if (avatarBtn) {
            avatarBtn.classList.remove('is-login-button');
            avatarBtn.innerHTML = user.photoURL
                ? `<img src="${escapeHTML(user.photoURL)}" style="width:100%; height:100%; border-radius:50%;" alt="Ảnh đại diện">`
                : '<i class="fa-solid fa-user"></i>';
            avatarBtn.title = 'Mở tài khoản và cài đặt';
            avatarBtn.setAttribute('aria-label', 'Mở tài khoản và cài đặt');
        }
        document.getElementById('account-profile-name').textContent = user.displayName || 'Người học';
        document.getElementById('account-profile-email').textContent = user.email || 'Đã đăng nhập';
        document.getElementById('account-profile-avatar').innerHTML = user.photoURL
            ? `<img src="${escapeHTML(user.photoURL)}" alt="">`
            : '<i class="fa-solid fa-user"></i>';
        syncAdminAccess(user);
        
        // Gọi hàm tải dữ liệu lưới nếu đang ở 2 trang này
        if (currentPage === 'home' || currentPage === 'created') {
            loadSets(currentPage); 
        }
        if (currentPage === 'home') loadSets('home-personal');
        // TÍNH NĂNG MỚI BỔ SUNG: Cập nhật biến đếm từ ở trang chủ
        if (currentPage === 'home') {
            updateTodayWordsDisplay(user.uid);
            renderForecastChart(user.uid); // KÍCH HOẠT BIỂU ĐỒ 7 NGÀY TẠI ĐÂY
            showNewUserWelcome(user);
        }
    } else {
        currentUser = null;
        syncAdminAccess(null);
        if (avatarBtn) {
            avatarBtn.classList.add('is-login-button');
            avatarBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i><span>Đăng nhập</span>';
            avatarBtn.title = 'Đăng nhập';
            avatarBtn.setAttribute('aria-label', 'Đăng nhập');
        }
        document.getElementById('account-profile-name').textContent = 'Khách';
        document.getElementById('account-profile-email').textContent = 'Đăng nhập để đồng bộ dữ liệu';
        document.getElementById('account-profile-avatar').innerHTML = '<i class="fa-solid fa-user"></i>';
        if (currentPage === 'home') {
            loadSets('home');
            loadSets('home-personal');
        }
        else if (currentPage === 'created') loadSets('created');
    }
});

// KIỂM TRA BẢO VỆ: Có nút avatar thì mới gắn sự kiện click
if (avatarBtn) {
    avatarBtn.addEventListener('click', () => {
        if (!currentUser) startGoogleSignIn();
        else openAccountDrawer();
    });
}

// ==========================================
// LOGIC RESET DỮ LIỆU (TRANG CHỦ)
// ==========================================
if (currentPage === 'home') {
    const settingsModal = document.getElementById('settings-modal');
    const guideModal = document.getElementById('guide-modal');
    const openGuide = document.getElementById('btn-open-guide');
    const aboutModal = document.getElementById('about-modal');
    const openAbout = document.getElementById('btn-open-about');

    if (guideModal && openGuide) {
        const closeGuide = () => { guideModal.style.display = 'none'; };
        openGuide.addEventListener('click', () => { guideModal.style.display = 'flex'; });
        document.getElementById('mobile-guide')?.addEventListener('click', () => { guideModal.style.display = 'flex'; });
        document.getElementById('btn-close-guide')?.addEventListener('click', closeGuide);
        document.getElementById('btn-guide-done')?.addEventListener('click', closeGuide);
    }

    if (aboutModal && openAbout) {
        const closeAbout = () => { aboutModal.style.display = 'none'; };
        openAbout.addEventListener('click', () => { aboutModal.style.display = 'flex'; });
        document.getElementById('btn-close-about')?.addEventListener('click', closeAbout);
        document.getElementById('btn-about-done')?.addEventListener('click', closeAbout);
    }
    
    if (settingsModal) {
        if (window.location.hash === '#settings') settingsModal.style.display = 'flex';
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
    const targetGrid = pageType === 'home-personal' ? personalGrid : grid;
    if (!targetGrid) return;
    if ((pageType === 'created' || pageType === 'home-personal') && !currentUser) {
        if (pageType === 'home-personal') {
            personalLibrarySection.hidden = true;
            targetGrid.replaceChildren();
            return;
        }
        const buttonId = pageType === 'created' ? 'btn-sign-in-created' : 'btn-sign-in-home-personal';
        targetGrid.innerHTML = `<div class="empty-state personal-library-empty" style="grid-column: 1 / -1;"><i class="fa-solid fa-lock"></i><h3>Đăng nhập để xem thư viện của bạn</h3><p>Các bộ thẻ cá nhân sẽ xuất hiện ngay tại đây.</p><button id="${buttonId}" class="btn btn-black" type="button"><i class="fa-brands fa-google"></i> Đăng nhập</button></div>`;
        document.getElementById(buttonId)?.addEventListener('click', () => startGoogleSignIn());
        return;
    }

    const newUserWelcomeModal = document.getElementById('new-user-welcome-modal');
    const closeNewUserWelcome = () => { if (newUserWelcomeModal) newUserWelcomeModal.style.display = 'none'; };
    document.getElementById('btn-close-new-user-welcome')?.addEventListener('click', closeNewUserWelcome);
    document.getElementById('btn-welcome-browse')?.addEventListener('click', closeNewUserWelcome);
    targetGrid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">${brandLoadingMarkup('Đang tải bộ thẻ...')}</div>`;

    try {
        let q;
        if (pageType === 'home') {
            q = query(collection(db, "study_sets"), where("isPublic", "==", true));
        } else if (pageType === 'created' || pageType === 'home-personal') {
            q = query(collection(db, "study_sets"), where("ownerId", "==", currentUser.uid));
        }

        // Tải tiến độ một lần rồi ghép với từng bộ thẻ. Trước đây UI luôn ghi cứng 0 từ/0%.
        const progressQuery = currentUser ? query(collection(db, "user_progress"), where("userId", "==", currentUser.uid)) : null;
        const [querySnapshot, progressSnapshot] = await Promise.all([getDocs(q), progressQuery ? getDocs(progressQuery) : Promise.resolve(null)]);
        const progressBySetId = new Map();
        progressSnapshot?.forEach((progressDoc) => {
            const progress = progressDoc.data();
            if (progress.setId) progressBySetId.set(progress.setId, progress.learnedCards || {});
        });
        const visibleSetDocs = pageType === 'home-personal'
            ? querySnapshot.docs.filter((setDoc) => setDoc.data().isPinnedHome === true)
            : querySnapshot.docs;
        if (pageType === 'home-personal') personalLibrarySection.hidden = visibleSetDocs.length === 0;
        targetGrid.innerHTML = '';

        if (!visibleSetDocs.length) {
            if (pageType === 'home-personal') return;
            const emptyHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <i class="fa-regular fa-folder-open"></i>
                    <h3>Chưa có bộ thẻ nào</h3>
                    <p>Bắt đầu bằng cách tạo bộ thẻ đầu tiên của bạn để học từ vựng</p>
                    <a href="/create/" class="btn btn-black empty-state-create-action" style="text-decoration: none; margin-top: 15px;">
                        <i class="fa-solid fa-plus"></i><span>Tạo Bộ thẻ</span>
                    </a>
                </div>
            `;
            targetGrid.innerHTML = emptyHTML;
            return;
        }

        visibleSetDocs.forEach((docSnap) => {
            const data = docSnap.data();
            const isMine = Boolean(currentUser && data.ownerId === currentUser.uid);
            const totalWords = Array.isArray(data.words) ? data.words.length : 0;
            const learnedCards = progressBySetId.get(docSnap.id) || {};
            const studiedCount = Object.values(learnedCards).filter((cardProgress) =>
                cardProgress && (cardProgress.status === 'learned' || cardProgress.status === 'reviewing')
            ).length;
            const progressPercent = totalWords > 0 ? Math.round((studiedCount / totalWords) * 100) : 0;

            const card = document.createElement('div');
            card.className = 'study-set-card';
            card.dataset.search = normalizeSearchText(`${data.title || ''} ${data.description || ''} ${data.authorName || ''}`);
            card.dataset.setId = docSnap.id;
            card.dataset.progress = String(progressPercent);
            card.dataset.words = String(totalWords);
            card.dataset.title = (data.title || '').toLocaleLowerCase('vi-VN');
            const publicationStatus = data.publicationStatus || (data.isPublic ? 'approved' : 'private');
            card.dataset.visibility = publicationStatus;
            card.setAttribute('role', 'link');
            card.tabIndex = 0;
            card.setAttribute('aria-label', `Bắt đầu học bộ thẻ ${data.title}`);
            
            const publicationMeta = {
                approved: ['#2563eb', 'fa-earth-americas', 'Công khai'],
                pending: ['#d97706', 'fa-clock', 'Chờ duyệt'],
                rejected: ['#dc2626', 'fa-pen-to-square', 'Cần chỉnh sửa'],
                private: ['#16a34a', 'fa-lock', 'Riêng tư']
            }[publicationStatus] || ['#16a34a', 'fa-lock', 'Riêng tư'];
            const statusIcon = `<span style="color: ${publicationMeta[0]};"><i class="fa-solid ${publicationMeta[1]}"></i> ${publicationMeta[2]}</span>`;
            const moderationNote = isMine && publicationStatus === 'rejected' && data.adminNote
                ? `<p class="set-moderation-note"><i class="fa-solid fa-circle-info"></i> ${escapeHTML(data.adminNote)}</p>`
                : '';
            const canQuickAdd = isMine && (pageType === 'created' || pageType === 'home-personal');
            const cardActions = canQuickAdd
                ? `<div class="set-card-actions"><button class="set-card-action set-card-study-button" type="button">Bắt đầu học <i class="fa-solid fa-arrow-right"></i></button><button class="set-card-quick-add" type="button" aria-label="Thêm từ vào ${escapeHTML(data.title || 'bộ thẻ này')}"><i class="fa-solid fa-plus"></i><span>Thêm từ</span></button></div>`
                : '<span class="set-card-action">Bắt đầu học <i class="fa-solid fa-arrow-right"></i></span>';

            if (canQuickAdd) {
                card.classList.add('has-dedicated-actions');
                card.setAttribute('role', 'group');
                card.removeAttribute('tabindex');
                card.setAttribute('aria-label', `Bộ thẻ ${data.title}`);
            }

            card.innerHTML = `
                <h4 class="set-title">${escapeHTML(data.title)}</h4>
                <p class="set-lang"><i class="fa-solid fa-book-open"></i> ${escapeHTML(data.description || 'Không có mô tả')}</p>
                ${moderationNote}
                
                <div class="progress-container">
                    <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${progressPercent}%;"></div></div>
                    <span class="progress-text">${studiedCount}/${totalWords} từ</span>
                </div>
                
                <div class="set-footer">
                    <span class="word-count">${statusIcon}</span>
                    <span class="author-tag"><i class="fa-regular fa-user"></i> ${escapeHTML(data.authorName || 'Ẩn danh')} ${isMine ? '(Bạn)' : ''}</span>
                </div>
                ${cardActions}
            `;

            card.querySelector('.set-card-quick-add')?.addEventListener('click', (event) => {
                event.stopPropagation();
                openQuickAdd(docSnap.id);
            });
            card.querySelector('.set-card-quick-add')?.addEventListener('keydown', (event) => event.stopPropagation());

            const openStudySet = () => {
                navigateTo(`/study/?id=${docSnap.id}`, 'Đang mở bộ thẻ');
            };
            card.querySelector('.set-card-study-button')?.addEventListener('click', (event) => {
                event.stopPropagation();
                openStudySet();
            });
            if (!canQuickAdd) {
                // Thẻ cộng đồng chỉ có một hành động nên toàn bộ bề mặt có thể mở bài học.
                card.addEventListener('click', openStudySet);
                card.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openStudySet();
                    }
                });
            }

            if (isMine && pageType === 'created') {
                card.classList.add('has-card-management');
                card.style.position = 'relative';
                const managementActions = document.createElement('div');
                managementActions.className = 'set-card-management';
                const pinBtn = document.createElement('button');
                const renderPinState = () => {
                    const isPinned = data.isPinnedHome === true;
                    pinBtn.className = `set-card-manage-btn set-card-pin${isPinned ? ' is-pinned' : ''}`;
                    pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
                    pinBtn.title = isPinned ? 'Bỏ ghim khỏi trang chủ' : 'Ghim ra trang chủ';
                    pinBtn.setAttribute('aria-label', pinBtn.title);
                    pinBtn.setAttribute('aria-pressed', String(isPinned));
                };
                pinBtn.type = 'button';
                renderPinState();
                pinBtn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    const nextPinned = data.isPinnedHome !== true;
                    pinBtn.disabled = true;
                    try {
                        await updateDoc(doc(db, 'study_sets', docSnap.id), { isPinnedHome: nextPinned });
                        data.isPinnedHome = nextPinned;
                        renderPinState();
                        showToast(nextPinned ? `Đã ghim “${data.title}” ra trang chủ.` : `Đã bỏ ghim “${data.title}” khỏi trang chủ.`, 'success');
                    } catch (error) {
                        console.error('Không thể cập nhật ghim:', error);
                        handleFirebaseError(error);
                    } finally {
                        pinBtn.disabled = false;
                    }
                });

                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'set-card-manage-btn set-card-delete';
                deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                deleteBtn.title = 'Xóa bộ thẻ';
                deleteBtn.setAttribute('aria-label', 'Xóa bộ thẻ');
                managementActions.append(pinBtn, deleteBtn);
                managementActions.addEventListener('keydown', (event) => event.stopPropagation());
                card.appendChild(managementActions);

                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation(); 
                    if (confirm(`Xóa bộ thẻ "${data.title}"?`)) {
                        await deleteDoc(doc(db, "study_sets", docSnap.id));
                        loadSets(currentPage);
                    }
                });
            }
            targetGrid.appendChild(card);
        });
        if (targetGrid === grid) applySetSearch();
    } catch (error) {
        console.error("Lỗi:", error);
        if (pageType === 'home-personal' && personalLibrarySection) personalLibrarySection.hidden = true;
        targetGrid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><i class="fa-solid fa-triangle-exclamation"></i><h3>Chưa thể tải bộ thẻ</h3><p>Vui lòng kiểm tra kết nối và thử lại.</p></div>';
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
        const forecastSummary = document.getElementById('forecast-summary');
        const forecastTotal = forecastCounts.reduce((total, count) => total + count, 0);
        if (forecastSummary) forecastSummary.textContent = forecastTotal ? `${forecastTotal} thẻ cần ôn` : 'Chưa có lịch ôn';
        const reviewNudge = document.getElementById('review-nudge');
        if (reviewNudge) {
            reviewNudge.hidden = dueToday === 0;
            document.getElementById('review-nudge-title').textContent = dueToday === 1 ? 'Có 1 thẻ chờ bạn ôn' : `Có ${dueToday} thẻ chờ bạn ôn`;
            document.getElementById('review-nudge-message').textContent = dueToday === 1 ? 'Ôn ngay lúc này để giữ nhịp ghi nhớ.' : 'Dành vài phút xử lý chúng trước khi quên.';
        }

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
// 5. LOGIC RIÊNG CHO TRANG TẠO / SỬA
// ==========================================
if (currentPage === 'create') {
    const vocabContainer = document.getElementById('vocab-cards-container');
    const btnAddCard = document.getElementById('btn-add-card');
    const btnSaveSet = document.getElementById('btn-save-set');
    const pageTitle = document.getElementById('page-title');
    const setTitleInput = document.getElementById('set-title');
    
    // Đọc URL xem có ID bộ thẻ không (Nếu có là chế độ Sửa)
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('id');

    setTitleInput?.addEventListener('input', () => setTitleInput.classList.remove('is-invalid'));

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
                        <input type="text" class="field-input input-term" placeholder="VD: Hello" value="${escapeHTML(term)}">
                        <small class="lookup-status" aria-live="polite"></small>
                    </div>
                    <div class="field-group">
                        <label>Định nghĩa</label>
                        <input type="text" class="field-input input-def" placeholder="VD: Xin chào" value="${escapeHTML(def)}">
                        <div class="definition-suggestions" hidden aria-live="polite"></div>
                    </div>
                </div>
                <div class="field-grid">
                    <div class="field-group">
                        <label>Phát âm</label>
                        <input type="text" class="field-input input-pron" value="${escapeHTML(pron)}">
                    </div>
                    <div class="field-group">
                        <label>Loại từ</label>
                        <input type="text" class="field-input input-type" value="${escapeHTML(type)}">
                    </div>
                </div>
                <div class="field-grid">
                    <div class="field-group">
                        <label>Ví dụ</label>
                        <input type="text" class="field-input input-ex" value="${escapeHTML(ex)}">
                    </div>
                    <div class="field-group">
                        <label>Từ đồng nghĩa</label>
                        <input type="text" class="field-input input-syn" value="${escapeHTML(syn)}">
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

    let editorInitialized = false;
    function seedEmptyCards() {
        if (editorInitialized) return;
        editorInitialized = true;
        for (let index = 0; index < 3; index++) addVocabRow();
    }

    // Trang tạo mới sẵn sàng ngay cả khi Firebase chưa trả về trạng thái đăng nhập.
    // Nhờ vậy dữ liệu vừa nhập sẽ không bị sự kiện đăng nhập xóa đi.
    if (!editId) seedEmptyCards();

    // --- LOGIC NHẬP DỮ LIỆU HÀNG LOẠT (BULK IMPORT) ---
    const importModal = document.getElementById('import-modal');
    document.getElementById('btn-open-import').addEventListener('click', () => importModal.style.display = 'flex');
    const closeImport = () => importModal.style.display = 'none';
    document.getElementById('btn-close-import').addEventListener('click', closeImport);
    document.getElementById('btn-cancel-import').addEventListener('click', closeImport);

    function parseDelimitedLine(line, delimiter) {
        const cells = [];
        let cell = '';
        let quoted = false;
        for (let index = 0; index < line.length; index++) {
            const character = line[index];
            if (character === '"' && line[index + 1] === '"') { cell += '"'; index++; }
            else if (character === '"') quoted = !quoted;
            else if (character === delimiter && !quoted) { cells.push(cell.trim()); cell = ''; }
            else cell += character;
        }
        cells.push(cell.trim());
        return cells;
    }

    function importVocabularyText(text, preferredDelimiter = null) {
        if (!text.trim()) return 0;

        const termSepVal = preferredDelimiter ? null : document.querySelector('input[name="term-sep"]:checked').value;
        const cardSepVal = document.querySelector('input[name="card-sep"]:checked').value;

        const cardSep = cardSepVal === 'newline' ? '\n' : ';';
        const termSep = preferredDelimiter || (termSepVal === 'tab' ? '\t' : ',');
        const rawCards = preferredDelimiter ? text.replace(/^\uFEFF/, '').split(/\r?\n/) : text.split(cardSep);
        let importedCount = 0;

        rawCards.forEach((row, rowIndex) => {
            if (!row.trim()) return;
            const parts = parseDelimitedLine(row, termSep);
            if (preferredDelimiter && rowIndex === 0 && /^(term|thuật ngữ|từ)$/i.test(parts[0] || '')) return;
            const t = parts[0]?.trim() || '';
            const d = parts[1]?.trim() || '';
            const p = parts[2]?.trim() || '';
            const ty = parts[3]?.trim() || '';
            const e = parts[4]?.trim() || '';
            const s = parts[5]?.trim() || '';

            if (t) { addVocabRow(t, d, p, ty, e, s); importedCount++; }
        });
        return importedCount;
    }

    document.getElementById('btn-process-import').addEventListener('click', () => {
        const text = document.getElementById('import-textarea').value;
        const importedCount = importVocabularyText(text);
        if (!importedCount) return showError('Chưa tìm thấy dòng từ vựng hợp lệ để nhập.');
        closeImport();
        document.getElementById('import-textarea').value = '';
        showToast(`Đã thêm ${importedCount} thẻ từ vựng.`, 'success');
    });

    document.getElementById('import-file')?.addEventListener('change', (event) => {
        const [file] = event.target.files;
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const content = String(reader.result || '');
            const delimiter = file.name.toLowerCase().endsWith('.tsv') || content.includes('\t') ? '\t' : ',';
            const importedCount = importVocabularyText(content, delimiter);
            if (importedCount) { closeImport(); showToast(`Đã nhập ${importedCount} thẻ từ file.`, 'success'); }
            else showError('File chưa có dữ liệu từ vựng hợp lệ.');
            event.target.value = '';
        };
        reader.readAsText(file, 'UTF-8');
    });

    document.getElementById('btn-export-set')?.addEventListener('click', () => {
        const rows = [...vocabContainer.querySelectorAll('.vocab-input-card')].map((card) => [
            card.querySelector('.input-term')?.value.trim() || '', card.querySelector('.input-def')?.value.trim() || '',
            card.querySelector('.input-pron')?.value.trim() || '', card.querySelector('.input-type')?.value.trim() || '',
            card.querySelector('.input-ex')?.value.trim() || '', card.querySelector('.input-syn')?.value.trim() || ''
        ]).filter((row) => row.some(Boolean));
        if (!rows.length) return showError('Hãy thêm ít nhất một từ trước khi xuất file.');
        const escapeCsvCell = (value) => `"${String(value).replace(/"/g, '""')}"`;
        const csvContent = '\uFEFF' + [['Term', 'Definition', 'Pronunciation', 'Type', 'Example', 'Synonyms'], ...rows]
            .map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
        const fileName = (document.getElementById('set-title').value.trim() || 'supervocab').replace(/[\\/:*?"<>|]/g, '-');
        const url = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        const link = document.createElement('a');
        link.href = url; link.download = `${fileName}.csv`; document.body.appendChild(link); link.click(); link.remove();
        URL.revokeObjectURL(url);
        showToast('Đã xuất bộ thẻ dạng CSV.', 'success');
    });

    // Bắt sự kiện bấm nút "Thêm thẻ" thủ công ở cuối trang
    btnAddCard.addEventListener('click', () => addVocabRow());
    document.getElementById('btn-add-card-top')?.addEventListener('click', () => addVocabRow());

    // --- KHỞI TẠO DỮ LIỆU KHI VÀO TRANG (CHỐNG DUPLICATE) ---
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        if (!editId || editorInitialized) return;

        // CHẾ ĐỘ SỬA: chỉ khởi tạo một lần để không làm mất thao tác đang nhập.
        editorInitialized = true;
        vocabContainer.innerHTML = '';
        pageTitle.textContent = "Chỉnh sửa bộ thẻ";
        btnSaveSet.textContent = "Hoàn tất";

        try {
            const docRef = doc(db, "study_sets", editId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.ownerId !== user.uid) {
                    showError('Bạn không có quyền chỉnh sửa bộ thẻ này.');
                    window.setTimeout(() => navigateTo('/created/'), 800);
                    return;
                }
                document.getElementById('set-title').value = data.title;
                document.getElementById('set-desc').value = data.description || '';
                const publicationStatus = data.publicationStatus || (data.isPublic ? 'approved' : 'private');
                document.getElementById('set-public').checked = publicationStatus === 'approved' || publicationStatus === 'pending';
                normalizeVocabularyWords(data.words).forEach((word) => addVocabRow(word.term, word.definition, word.pronunciation, word.type, word.example, word.synonyms));
            }
        } catch (error) { console.error(error); }
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

        const wordsArray = normalizeVocabularyWords([...document.querySelectorAll('.vocab-input-card')].map((card) => ({
            term: card.querySelector('.input-term').value,
            definition: card.querySelector('.input-def').value,
            pronunciation: card.querySelector('.input-pron').value,
            type: card.querySelector('.input-type').value,
            example: card.querySelector('.input-ex').value,
            synonyms: card.querySelector('.input-syn').value
        })));

        if (wordsArray.length === 0) return alert("Cần ít nhất 1 từ vựng hợp lệ!");
        btnSaveSet.innerHTML = brandButtonLoading('Đang lưu...');

        const isPublicRequest = document.getElementById('set-public').checked;
        const setData = {
            title: title,
            description: document.getElementById('set-desc').value.trim(),
            // Người dùng không thể tự công khai: bật công tắc chỉ gửi yêu cầu tới hàng chờ của admin.
            isPublic: false,
            publicationStatus: isPublicRequest ? 'pending' : 'private',
            words: wordsArray
        };

        try {
            if (editId) {
                await updateDoc(doc(db, "study_sets", editId), setData);
                showSuccess(isPublicRequest ? 'Đã cập nhật và gửi lại để admin duyệt.' : 'Cập nhật bộ thẻ thành công!');
                setTimeout(() => navigateTo(`/study/?id=${editId}`), 500);
            } else {
                setData.ownerId = currentUser.uid;
                setData.authorName = currentUser.displayName;
                setData.timestamp = new Date();
                await addDoc(collection(db, "study_sets"), setData);
                showSuccess(isPublicRequest ? 'Đã gửi bộ thẻ chờ admin duyệt.' : 'Tạo bộ thẻ thành công!');
                setTimeout(() => navigateTo('/created/'), 800);
            }
        } catch (error) {
            console.error("Lỗi:", error);
            handleFirebaseError(error);
            btnSaveSet.textContent = editId ? "Hoàn tất" : "Tạo";
        }
    });

    // ==========================================
    // TỰ ĐỘNG TRA TỪ: chỉ cập nhật dữ liệu do hệ thống tạo, không ghi đè nội dung người học tự sửa.
    // ==========================================
    const lookupControllers = new WeakMap();
    const senseSelectionTokens = new WeakMap();
    const translatedSenseCache = new Map();
    const autoFields = ['.input-def', '.input-pron', '.input-type', '.input-ex', '.input-syn'];

    function setLookupStatus(card, message = '', state = '') {
        const status = card.querySelector('.lookup-status');
        if (!status) return;
        status.textContent = message;
        status.dataset.state = state;
    }

    function clearOutdatedAutoValues(card, word) {
        clearDefinitionSuggestions(card);
        autoFields.forEach((selector) => {
            const input = card.querySelector(selector);
            if (input?.dataset.autoFilledFor && input.dataset.autoFilledFor !== word) {
                input.value = '';
                delete input.dataset.autoFilledFor;
            }
        });
    }

    function applyAutoValue(card, selector, value, word) {
        if (!value) return false;
        const input = card.querySelector(selector);
        if (!input || (input.value && !input.dataset.autoFilledFor)) return false;
        input.value = value;
        input.dataset.autoFilledFor = word;
        clearInputValidation(input);
        return true;
    }

    // Khi đổi nghĩa, chỉ thay dữ liệu do hệ thống điền; nội dung người học nhập tay luôn được giữ lại.
    function replaceAutoValue(card, selector, value, word, force = false) {
        const input = card.querySelector(selector);
        if (!input || (!force && input.value && !input.dataset.autoFilledFor)) return false;
        if (!value) {
            if (input.dataset.autoFilledFor === word) {
                input.value = '';
                delete input.dataset.autoFilledFor;
            }
            return false;
        }
        input.value = value;
        input.dataset.autoFilledFor = word;
        clearInputValidation(input);
        return true;
    }

    function clearDefinitionSuggestions(card) {
        const suggestions = card.querySelector('.definition-suggestions');
        if (!suggestions) return;
        suggestions.replaceChildren();
        suggestions.hidden = true;
    }

    function showDefinitionSuggestions(card, suggestions, word, detailsByPart = {}, fallbackDetails = emptyDictionaryDetails(), senseDetails = [], activeDefinition = '') {
        const container = card.querySelector('.definition-suggestions');
        if (!container) return;

        const uniqueSuggestions = [];
        const seen = new Map();
        suggestions.forEach((suggestion) => {
            const value = textValue(suggestion?.value || suggestion).replace(/\s+/g, ' ').normalize('NFC');
            if (!value) return;
            const key = value.toLocaleLowerCase('vi');
            const partOfSpeech = textValue(suggestion?.partOfSpeech).toLowerCase();
            const existing = seen.get(key);
            if (existing) {
                // Ưu tiên bản có loại từ: “sách” ở kết quả dịch nhanh sẽ gắn đúng với “danh từ”.
                if (!existing.partOfSpeech && partOfSpeech) {
                    existing.partOfSpeech = partOfSpeech;
                    existing.label = textValue(suggestion?.label) || value;
                }
                return;
            }
            const normalizedSuggestion = {
                value,
                label: textValue(suggestion?.label) || value,
                partOfSpeech
            };
            seen.set(key, normalizedSuggestion);
            uniqueSuggestions.push(normalizedSuggestion);
        });

        container.replaceChildren();
        if (uniqueSuggestions.length < 2) {
            container.hidden = true;
            return;
        }

        const title = document.createElement('span');
        title.className = 'definition-suggestions-title';
        title.innerHTML = '<i class="fa-solid fa-list-check"></i> Chọn nghĩa phù hợp';
        const choices = document.createElement('div');
        choices.className = 'definition-suggestion-options';

        uniqueSuggestions.slice(0, 6).forEach(({ value, label, partOfSpeech }) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'definition-suggestion-option';
            button.textContent = label;
            if (value.toLocaleLowerCase('vi') === textValue(activeDefinition).normalize('NFC').toLocaleLowerCase('vi')) {
                button.classList.add('is-selected');
            }
            button.addEventListener('click', async () => {
                const definitionInput = card.querySelector('.input-def');
                if (!definitionInput) return;
                // Đây là thao tác chọn chủ động nên luôn thay định nghĩa, kể cả khi ô này đã được gõ trước đó.
                definitionInput.value = value;
                definitionInput.dataset.autoFilledFor = word;
                clearInputValidation(definitionInput);
                choices.querySelectorAll('.definition-suggestion-option').forEach((item) => item.classList.toggle('is-selected', item === button));

                // Tránh giữ bất kỳ thuộc tính nào của nghĩa cũ trong lúc đang tra nghĩa mới.
                ['.input-pron', '.input-type', '.input-ex', '.input-syn'].forEach((selector) => replaceAutoValue(card, selector, '', word, true));
                const selectionToken = (senseSelectionTokens.get(card) || 0) + 1;
                senseSelectionTokens.set(card, selectionToken);
                setLookupStatus(card, `Đang cập nhật phát âm, loại từ, ví dụ và từ đồng nghĩa cho nghĩa “${value}”…`, 'loading');

                try {
                    const matchedDetails = await findDetailsForSelectedMeaning(word, value, partOfSpeech, senseDetails);
                    if (senseSelectionTokens.get(card) !== selectionToken || termInputValue(card) !== word) return;

                    // Nếu chưa ghép được ví dụ chính xác, vẫn cập nhật phát âm/loại từ và để trống ví dụ thay vì dùng ví dụ sai.
                    const generalDetails = detailsByPart[partOfSpeech] || fallbackDetails;
                    const selectedDetails = matchedDetails || {
                        phonetic: generalDetails.phonetic,
                        partOfSpeech: generalDetails.partOfSpeech,
                        example: '',
                        synonyms: ''
                    };
                    replaceAutoValue(card, '.input-pron', selectedDetails.phonetic, word, true);
                    replaceAutoValue(card, '.input-type', selectedDetails.partOfSpeech, word, true);
                    replaceAutoValue(card, '.input-ex', selectedDetails.example, word, true);
                    replaceAutoValue(card, '.input-syn', selectedDetails.synonyms, word, true);
                    const selectedType = selectedDetails.partOfSpeech ? ` (${selectedDetails.partOfSpeech})` : '';
                    setLookupStatus(card, matchedDetails
                        ? `Đã chọn nghĩa “${value}”${selectedType} và cập nhật toàn bộ thông tin liên quan.`
                        : `Đã chọn nghĩa “${value}”${selectedType}. Không có đủ dữ liệu riêng cho nghĩa này; thông tin cũ đã được xóa.`, matchedDetails ? 'success' : 'error');
                } catch (error) {
                    if (senseSelectionTokens.get(card) !== selectionToken) return;
                    console.warn('Không thể cập nhật thuộc tính theo nghĩa đã chọn:', error);
                    setLookupStatus(card, `Đã chọn nghĩa “${value}”. Không thể tìm dữ liệu phù hợp, nên toàn bộ thông tin cũ đã được xóa.`, 'error');
                }
            });
            choices.appendChild(button);
        });

        container.append(title, choices);
        container.hidden = false;
    }

    function findDictionaryDetails(entries) {
        const entry = entries?.[0] || {};
        const meanings = entry.meanings || [];
        const meaning = meanings.find((item) => item.definitions?.some((definition) => definition.example) || item.synonyms?.length) || meanings[0] || {};
        const definition = meaning.definitions?.find((item) => item.example) || meaning.definitions?.[0] || {};
        const synonyms = [...new Set([
            ...(meaning.synonyms || []),
            ...(definition.synonyms || [])
        ])].slice(0, 3).join(', ');

        return {
            phonetic: entry.phonetic || entry.phonetics?.find((item) => item.text)?.text || '',
            partOfSpeech: meaning.partOfSpeech || '',
            example: definition.example || '',
            synonyms
        };
    }

    function findDictionaryDetailsByPart(entries) {
        const detailsByPart = {};

        (entries || []).forEach((entry) => {
            const phonetic = entry.phonetic || entry.phonetics?.find((item) => item.text)?.text || '';
            (entry.meanings || []).forEach((meaning) => {
                const key = textValue(meaning.partOfSpeech).toLowerCase();
                if (!key) return;
                const definition = meaning.definitions?.find((item) => item.example) || meaning.definitions?.[0] || {};
                const synonyms = [...new Set([
                    ...(meaning.synonyms || []),
                    ...(definition.synonyms || [])
                ])].slice(0, 3).join(', ');
                const candidate = {
                    phonetic,
                    partOfSpeech: meaning.partOfSpeech || '',
                    example: definition.example || '',
                    synonyms
                };
                if (!detailsByPart[key] || dictionaryDetailCount(candidate) > dictionaryDetailCount(detailsByPart[key])) {
                    detailsByPart[key] = candidate;
                }
            });
        });

        return detailsByPart;
    }

    function getDictionarySenses(entries) {
        return (entries || []).flatMap((entry) => {
            const phonetic = entry.phonetic || entry.phonetics?.find((item) => item.text)?.text || '';
            return (entry.meanings || []).flatMap((meaning) => (meaning.definitions || []).map((definition) => ({
                phonetic,
                partOfSpeech: textValue(meaning.partOfSpeech),
                definition: textValue(definition.definition),
                example: textValue(definition.example),
                synonyms: [...new Set([...(meaning.synonyms || []), ...(definition.synonyms || [])])].slice(0, 3).join(', ')
            }))).filter((sense) => sense.definition);
        });
    }

    function termInputValue(card) {
        return card.querySelector('.input-term')?.value.trim() || '';
    }

    function normalizeMeaningText(value) {
        return textValue(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    }

    async function getTranslatedSenses(word, senses) {
        const cacheKey = `${word.toLocaleLowerCase('en')}|${senses.map((sense) => `${sense.partOfSpeech}:${sense.definition}`).join('\u001f')}`;
        if (translatedSenseCache.has(cacheKey)) return translatedSenseCache.get(cacheKey);

        const translationPromise = (async () => {
            const requestText = senses.map((sense, index) => `${sense.definition}\n@@SENSE_${index}@@`).join('\n');
            const response = await fetchWithTimeout(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(requestText)}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const translationData = await response.json();
            const translated = Array(senses.length).fill('');
            let currentIndex = 0;

            (translationData?.[0] || []).forEach((part) => {
                const source = textValue(part?.[1]);
                const marker = source.match(/@@SENSE_(\d+)@@/);
                if (marker) {
                    currentIndex = Number(marker[1]) + 1;
                    return;
                }
                if (currentIndex < translated.length) translated[currentIndex] += textValue(part?.[0]);
            });

            return senses.map((sense, index) => ({ ...sense, translatedDefinition: translated[index] }));
        })();

        translatedSenseCache.set(cacheKey, translationPromise);
        try {
            return await translationPromise;
        } catch (error) {
            translatedSenseCache.delete(cacheKey);
            throw error;
        }
    }

    async function findDetailsForSelectedMeaning(word, selectedMeaning, partOfSpeech, senses) {
        const candidates = senses.filter((sense) => !partOfSpeech || sense.partOfSpeech.toLowerCase() === partOfSpeech);
        if (!candidates.length) return null;
        if (candidates.length === 1) return candidates[0];

        const selectedText = normalizeMeaningText(selectedMeaning);
        const selectedTokens = selectedText.split(' ').filter((token) => token.length > 1);
        const translatedSenses = await getTranslatedSenses(word, candidates);
        const ranked = translatedSenses.map((sense) => {
            const translatedText = normalizeMeaningText(sense.translatedDefinition);
            const matchedTokens = selectedTokens.filter((token) => translatedText.includes(token)).length;
            const exactPhraseBonus = selectedText && translatedText.includes(selectedText) ? 20 : 0;
            return { sense, score: exactPhraseBonus + matchedTokens };
        }).sort((left, right) => right.score - left.score);

        return ranked[0]?.score > 0 ? ranked[0].sense : null;
    }

    const emptyDictionaryDetails = () => ({ phonetic: '', partOfSpeech: '', example: '', synonyms: '' });
    const dictionaryDetailCount = (details) => Object.values(details).filter(Boolean).length;
    const waitBeforeLookupRetry = () => new Promise((resolve) => window.setTimeout(resolve, 450));

    async function fetchDictionaryDetailsWithRetry(word, signal, maxAttempts = 1) {
        let bestDetails = emptyDictionaryDetails();
        let bestDetailsByPart = {};
        let bestSenseDetails = [];

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const response = await fetchWithTimeout(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal });

                // 404 thường là sai chính tả hoặc từ không có trong từ điển: không gọi lại vô ích.
                if (response.status === 404) return { details: bestDetails, detailsByPart: bestDetailsByPart, senseDetails: bestSenseDetails, notFound: true };
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const entries = await response.json();
                const details = findDictionaryDetails(entries);
                const detailsByPart = findDictionaryDetailsByPart(entries);
                const senseDetails = getDictionarySenses(entries);
                if (dictionaryDetailCount(details) > dictionaryDetailCount(bestDetails)) bestDetails = details;
                if (senseDetails.length > bestSenseDetails.length) bestSenseDetails = senseDetails;
                Object.entries(detailsByPart).forEach(([partOfSpeech, candidate]) => {
                    if (!bestDetailsByPart[partOfSpeech] || dictionaryDetailCount(candidate) > dictionaryDetailCount(bestDetailsByPart[partOfSpeech])) {
                        bestDetailsByPart[partOfSpeech] = candidate;
                    }
                });

                // Có ít nhất hai trường bổ sung là phản hồi đủ tin cậy; không cần thử lại thêm.
                if (dictionaryDetailCount(bestDetails) >= 2) break;
            } catch (error) {
                if (error.name === 'AbortError') throw error;
            }

            if (attempt < maxAttempts - 1) await waitBeforeLookupRetry();
        }

        return { details: bestDetails, detailsByPart: bestDetailsByPart, senseDetails: bestSenseDetails, notFound: false };
    }

    function getTranslationSuggestions(translationData, fallback = '') {
        const suggestions = [];
        const dictionaryGroups = Array.isArray(translationData?.[1]) ? translationData[1] : [];
        const partOfSpeechLabels = {
            verb: 'v', noun: 'n', adjective: 'adj', adverb: 'adv',
            pronoun: 'pron', preposition: 'prep', conjunction: 'conj', interjection: 'interj'
        };

        dictionaryGroups.forEach((group) => {
            const rawPartOfSpeech = textValue(group?.[0]);
            const partOfSpeech = partOfSpeechLabels[rawPartOfSpeech.toLowerCase()] || rawPartOfSpeech;
            const candidates = Array.isArray(group?.[1]) ? group[1] : [];
            candidates.forEach((candidate) => {
                const value = textValue(Array.isArray(candidate) ? candidate[0] : candidate);
                if (!value) return;
                suggestions.push({
                    value,
                    label: partOfSpeech ? `${value} · ${partOfSpeech}` : value,
                    partOfSpeech: rawPartOfSpeech
                });
            });
        });

        if (fallback) suggestions.unshift({ value: fallback, label: fallback, partOfSpeech: '' });
        return suggestions;
    }

    async function fetchTranslationWithRetry(word, signal) {
        const result = await fetchVietnameseTranslation(word, signal);
        return {
            definition: result.definition,
            suggestions: result.googleData
                ? getTranslationSuggestions(result.googleData, result.definition)
                : (result.definition ? [{ value: result.definition, label: result.definition, partOfSpeech: '' }] : [])
        };
    }

    async function lookUpVocabulary(termInput) {
        const word = termInput.value.trim();
        const card = termInput.closest('.vocab-input-card');
        if (!card || !word) return;

        lookupControllers.get(card)?.abort();
        const controller = new AbortController();
        lookupControllers.set(card, controller);
        clearOutdatedAutoValues(card, word);
        setLookupStatus(card, 'Đang tìm nghĩa và thông tin từ…', 'loading');

        let details = emptyDictionaryDetails();
        let detailsByPart = {};
        let senseDetails = [];
        let definitionVi = '';
        let definitionSuggestions = [];
        let dictionaryNotFound = false;

        try {
            const [dictionaryLookup, translationLookup] = await Promise.all([
                fetchDictionaryDetailsWithRetry(word, controller.signal),
                fetchTranslationWithRetry(word, controller.signal)
            ]);

            details = dictionaryLookup.details;
            detailsByPart = dictionaryLookup.detailsByPart;
            senseDetails = dictionaryLookup.senseDetails;
            dictionaryNotFound = dictionaryLookup.notFound;
            definitionVi = translationLookup.definition;
            definitionSuggestions = translationLookup.suggestions;
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.warn('Không thể tự động tra từ:', error);
        }

        // Không để một yêu cầu cũ (ví dụ “hello”) ghi đè dữ liệu của từ vừa sửa (“father”).
        if (controller.signal.aborted || termInput.value.trim() !== word) return;

        const foundFields = [
            definitionVi && 'nghĩa',
            details.phonetic && 'phát âm',
            details.partOfSpeech && 'loại từ',
            details.example && 'ví dụ',
            details.synonyms && 'từ đồng nghĩa'
        ].filter(Boolean);
        const needsDefinitionChoice = definitionSuggestions.length > 1;
        showDefinitionSuggestions(card, definitionSuggestions, word, detailsByPart, details, senseDetails, definitionVi);
        // Luồng mặc định vẫn như trước: điền nghĩa đầu tiên và các thuộc tính ngay khi tra xong.
        const detailsToApply = details;
        const updated = [
            applyAutoValue(card, '.input-def', definitionVi, word),
            applyAutoValue(card, '.input-pron', detailsToApply.phonetic, word),
            applyAutoValue(card, '.input-type', detailsToApply.partOfSpeech, word),
            applyAutoValue(card, '.input-ex', detailsToApply.example, word),
            applyAutoValue(card, '.input-syn', detailsToApply.synonyms, word)
        ].some(Boolean);

        if (needsDefinitionChoice) {
            setLookupStatus(card, `Tìm thấy ${definitionSuggestions.length} nghĩa. Hãy chọn nghĩa phù hợp ở ô Định nghĩa.`, 'success');
        } else if (updated && foundFields.length === 5) {
            setLookupStatus(card, 'Đã cập nhật đầy đủ thông tin tự động.', 'success');
        } else if (updated && dictionaryNotFound) {
            setLookupStatus(card, 'Đã dịch nghĩa nhưng không nhận diện được từ trong từ điển. Hãy kiểm tra lại chính tả.', 'error');
        } else if (updated) {
            setLookupStatus(card, `Đã cập nhật ${foundFields.length}/5 mục (${foundFields.join(', ')}). Một số thông tin chưa có từ nguồn tra cứu.`, 'success');
        } else if (dictionaryNotFound) {
            setLookupStatus(card, 'Không nhận diện được từ trong từ điển. Hãy kiểm tra lại chính tả.', 'error');
        } else {
            setLookupStatus(card, 'Không tìm thấy dữ liệu phù hợp. Bạn vẫn có thể nhập thủ công.', 'error');
        }
    }

    vocabContainer.addEventListener('input', (event) => {
        if (!event.target.classList.contains('field-input')) return;
        clearInputValidation(event.target);

        if (event.target.classList.contains('input-term')) {
            const card = event.target.closest('.vocab-input-card');
            lookupControllers.get(card)?.abort();
            setLookupStatus(card, event.target.value.trim() ? 'Sẽ tra lại khi bạn rời ô thuật ngữ.' : '', '');
            return;
        }

        // Nếu người học tự sửa một ô, dữ liệu đó luôn được ưu tiên ở lần tra tiếp theo.
        delete event.target.dataset.autoFilledFor;
    });

    vocabContainer.addEventListener('focusout', (event) => {
        if (event.target.classList.contains('input-term') && event.target.value.trim()) {
            lookUpVocabulary(event.target);
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
// 6. LOGIC TRANG HỌC FLASHCARD
// ==========================================

// ==========================================
    // LOGIC BẢNG CÀI ĐẶT QUIZ (An toàn tuyệt đối)
    // ==========================================
    const quizModal = document.getElementById('quiz-setup-modal');
    const btnOpenQuiz = document.getElementById('btn-open-quiz-setup');

    if (btnOpenQuiz && quizModal) {
            // Mở popup không cần check mảng (vì trang quiz sẽ tự check)
        btnOpenQuiz.addEventListener('click', () => {
            quizModal.style.display = 'flex';
        });

        document.getElementById('btn-close-quiz')?.addEventListener('click', () => {
            quizModal.style.display = 'none';
        });
        
        document.getElementById('btn-start-quiz')?.addEventListener('click', async (event) => {
            const startButton = event.currentTarget;
            // Tự lấy ID từ URL hiện tại luôn cho an toàn
            const currentUrlParams = new URLSearchParams(window.location.search);
            const currentSetId = currentUrlParams.get('id');
            const filter = document.getElementById('quiz-filter').value;
            const mode = document.getElementById('quiz-mode').value;
            const limit = document.getElementById('quiz-limit').value;

            if (!currentSetId) return showError('Không tìm thấy bộ thẻ để tạo Quiz.');
            if (!currentUser && filter !== 'all') {
                requestSignIn('lọc từ theo tiến độ học');
                return;
            }

            const originalText = startButton.innerHTML;
            startButton.disabled = true;
            startButton.innerHTML = brandButtonLoading('Đang kiểm tra...');
            try {
                const setSnapshot = await getDoc(doc(db, 'study_sets', currentSetId));
                if (!setSnapshot.exists()) throw new Error('Bộ thẻ không tồn tại.');

                const validWords = (Array.isArray(setSnapshot.data().words) ? setSnapshot.data().words : [])
                    .map((word, originalIndex) => ({ word: normalizeVocabularyWord(word), originalIndex }))
                    .filter((item) => item.word);
                let learnedCards = {};
                if (currentUser && filter !== 'all') {
                    const progressSnapshot = await getDoc(doc(db, 'user_progress', `${currentUser.uid}_${currentSetId}`));
                    const storedProgress = progressSnapshot.exists() ? progressSnapshot.data().learnedCards : null;
                    learnedCards = storedProgress && typeof storedProgress === 'object' ? storedProgress : {};
                }

                const availableCount = validWords.filter(({ originalIndex }) => {
                    const isLearned = learnedCards[originalIndex]?.status === 'learned';
                    return filter === 'all' || (filter === 'learned' ? isLearned : !isLearned);
                }).length;
                if (availableCount < 4) {
                    showError(`Bộ lọc hiện chỉ có ${availableCount} từ hợp lệ. Quiz cần ít nhất 4 từ để tạo đáp án.`);
                    return;
                }

                const requestedCount = limit === 'all' ? availableCount : Number(limit);
                let effectiveLimit = limit;
                if (requestedCount > availableCount) {
                    const accepted = window.confirm(`Bộ lọc chỉ có ${availableCount} từ, ít hơn ${requestedCount} câu bạn đã chọn. Bạn có muốn tiếp tục làm ${availableCount} câu không?`);
                    if (!accepted) return;
                    effectiveLimit = String(availableCount);
                }

                navigateTo(`/quiz/?id=${encodeURIComponent(currentSetId)}&filter=${encodeURIComponent(filter)}&mode=${encodeURIComponent(mode)}&limit=${encodeURIComponent(effectiveLimit)}`);
            } catch (error) {
                console.error('Không thể kiểm tra bộ lọc Quiz:', error);
                showError(error.message || 'Không thể kiểm tra số lượng từ. Vui lòng thử lại.');
            } finally {
                startButton.disabled = false;
                startButton.innerHTML = originalText;
            }
        });
    }
if (currentPage === 'study') {
    const urlParams = new URLSearchParams(window.location.search);
    const setId = urlParams.get('id');

    let wordsArray = [];
    let allWordsArray = [];
    let currentIndex = 0;
    let isRandomMode = false;
    let activeStudyFilter = 'all';
    let studyProgress = {}; // Bây giờ sẽ lưu dạng Object SM-2 thay vì boolean
    let touchStartX = null;
    let ignoreNextFlashcardClick = false;

    const flashcard = document.getElementById('flashcard');
    const flashcardContainer = document.getElementById('fc-container');
    const wordListContainer = document.getElementById('word-list-container');
    const studyCardFilter = document.getElementById('study-card-filter');
    const studyCardFilterTrigger = document.getElementById('study-card-filter-trigger');
    const studyCardFilterLabel = document.getElementById('study-card-filter-label');
    const studyCardFilterMenu = document.getElementById('study-card-filter-menu');
    const autoPlayAudio = document.getElementById('auto-play-audio');
    const autoPlayPreferenceKey = 'vocab_auto_play_audio';
    autoPlayAudio.checked = localStorage.getItem(autoPlayPreferenceKey) === 'true';

    function speakWord(text) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
    }

    autoPlayAudio.addEventListener('change', () => {
        localStorage.setItem(autoPlayPreferenceKey, String(autoPlayAudio.checked));
        showToast(autoPlayAudio.checked ? 'Đã bật tự động phát âm.' : 'Đã tắt tự động phát âm.', 'info');
        if (autoPlayAudio.checked && wordsArray[currentIndex]) speakWord(wordsArray[currentIndex].term);
    });

    document.getElementById('btn-play-audio').addEventListener('click', (e) => {
        e.stopPropagation(); 
        if (wordsArray[currentIndex]) speakWord(wordsArray[currentIndex].term);
    });

    flashcard.addEventListener('click', () => {
        if (ignoreNextFlashcardClick) {
            ignoreNextFlashcardClick = false;
            return;
        }
        flashcard.classList.toggle('is-flipped');
    });

    flashcard.addEventListener('touchstart', (event) => {
        touchStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });
    flashcard.addEventListener('touchend', (event) => {
        const touchEndX = event.changedTouches[0]?.clientX ?? null;
        if (touchStartX === null || touchEndX === null) return;
        const distance = touchEndX - touchStartX;
        touchStartX = null;
        if (Math.abs(distance) < 56) return;
        ignoreNextFlashcardClick = true;
        if (distance < 0) document.getElementById('btn-next').click();
        else document.getElementById('btn-prev').click();
        navigator.vibrate?.(8);
    }, { passive: true });

    function updateStudyFilterControl() {
        if (!studyCardFilterTrigger) return;
        studyCardFilterTrigger.disabled = allWordsArray.length === 0;
    }

    function applyStudyFilter({ afterSourceIndex = null, shouldUpdate = true } = {}) {
        const visibleSourceIndex = wordsArray[currentIndex]?.sourceIndex;
        wordsArray = activeStudyFilter === 'unlearned'
            ? allWordsArray.filter((word) => !studyProgress[word.sourceIndex])
            : [...allWordsArray];

        if (wordsArray.length > 0) {
            let nextIndex = afterSourceIndex === null
                ? -1
                : wordsArray.findIndex((word) => word.sourceIndex > afterSourceIndex);
            if (nextIndex < 0 && visibleSourceIndex !== undefined) {
                nextIndex = wordsArray.findIndex((word) => word.sourceIndex === visibleSourceIndex);
            }
            currentIndex = nextIndex >= 0 ? nextIndex : Math.min(currentIndex, wordsArray.length - 1);
        } else {
            currentIndex = 0;
        }

        updateStudyFilterControl();
        if (shouldUpdate) updateUI();
    }

    function resetStudyFlashcardBeforeContentChange() {
        if (!flashcard.classList.contains('is-flipped')) return false;
        flashcard.classList.add('is-resetting');
        flashcard.classList.remove('is-flipped');
        // Chốt trạng thái mặt trước trước khi nội dung mặt sau được thay đổi.
        void flashcard.offsetWidth;
        return true;
    }

    function finishStudyFlashcardContentChange(wasReset) {
        if (wasReset) flashcard.classList.remove('is-resetting');
    }

    function showStudyEmptyState(message = 'Bộ thẻ này chưa có từ vựng hợp lệ.') {
        const wasReset = resetStudyFlashcardBeforeContentChange();
        document.getElementById('fc-front-word').textContent = message;
        document.getElementById('fc-front-pron').textContent = allWordsArray.length
            ? 'Bạn có thể chuyển về “Tất cả thẻ” để xem lại tiến độ.'
            : 'Hãy quay lại chỉnh sửa và thêm thuật ngữ cùng định nghĩa.';
        document.getElementById('fc-back-def').textContent = '';
        document.getElementById('fc-back-syn').style.display = 'none';
        document.getElementById('fc-back-ex').style.display = 'none';
        document.getElementById('fc-counter').textContent = '0 / 0';
        document.getElementById('fc-counter-progress').textContent = '0 / 0';
        const learnedCount = allWordsArray.filter((word) => studyProgress[word.sourceIndex]?.status === 'learned').length;
        document.getElementById('word-list-count').textContent = `${learnedCount}/${allWordsArray.length} đã thuộc`;
        if (allWordsArray.length > 0) renderList();
        else wordListContainer.innerHTML = '<p class="study-empty-message">Chưa có thẻ nào để học.</p>';
        finishStudyFlashcardContentChange(wasReset);
    }

    function updateUI() {
        if (wordsArray.length === 0) {
            showStudyEmptyState();
            return;
        }
        const currentWord = wordsArray[currentIndex];
        const wasReset = resetStudyFlashcardBeforeContentChange();

        // MẶT TRƯỚC: Chỉ hiện duy nhất từ vựng để tăng độ khó và tập trung
        document.getElementById('fc-front-word').textContent = currentWord.term;
        document.getElementById('fc-front-pron').textContent = ''; // Xóa sạch mọi gợi ý
        
        // MẶT SAU: Gộp Loại từ, Phát âm hiển thị nhỏ ở trên Định nghĩa
        const typePron = `${currentWord.type ? currentWord.type + ' - ' : ''} ${currentWord.pronunciation || ''}`.trim();
        
        // Render HTML kết hợp rất đẹp mắt
        document.getElementById('fc-back-def').innerHTML =
            (typePron ? `<span style="font-size: 16px; color: #777; font-weight: normal; display: block; margin-bottom: 8px;">${escapeHTML(typePron)}</span>` : '') +
            escapeHTML(currentWord.definition);
        
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

        const counterText = `Thẻ ${currentIndex + 1} / ${wordsArray.length}`;
        document.getElementById('fc-counter').textContent = counterText;
        document.getElementById('fc-counter-progress').textContent = counterText;
        renderList();
        finishStudyFlashcardContentChange(wasReset);
        if (autoPlayAudio.checked) window.setTimeout(() => speakWord(currentWord.term), 120);
    }

    // --- CẬP NHẬT: VẼ LẠI DANH SÁCH BÊN DƯỚI THEO TRẠNG THÁI MỚI ---
    function renderList() {
        wordListContainer.innerHTML = '';
        const learnedCount = allWordsArray.filter((word) => studyProgress[word.sourceIndex]?.status === 'learned').length;
        document.getElementById('word-list-count').textContent = `${learnedCount}/${allWordsArray.length} đã thuộc`;
        allWordsArray.forEach((word) => {
            const progressData = studyProgress[word.sourceIndex] || {};
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
                    <h4 style="font-size:18px;">${escapeHTML(word.term)} <span style="font-size:12px; color:#777; font-weight:normal;">${escapeHTML(word.pronunciation || '')}</span></h4>
                    <p style="color:#555; font-size:14px; margin-top:5px;">${escapeHTML(word.type ? word.type + ' - ' : '')} ${escapeHTML(word.definition)}</p>
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
                if (!currentUser && data.isPublic !== true) {
                    showStudyEmptyState('Bộ thẻ này là nội dung riêng tư.');
                    requestSignIn('mở bộ thẻ riêng tư');
                    return;
                }
                document.getElementById('study-set-title').textContent = data.title;
                allWordsArray = normalizeVocabularyWords(data.words)
                    .map((word, sourceIndex) => ({ ...word, sourceIndex }));
                currentIndex = 0;
                applyStudyFilter({ shouldUpdate: false });
                // Hiển thị thẻ đầu tiên ngay; việc tải tiến độ không được làm chậm buổi học.
                updateUI();

                if (currentUser) {
                    const progressRef = doc(db, "user_progress", `${currentUser.uid}_${setId}`);
                    try {
                        const progressSnap = await getDoc(progressRef);
                        if (progressSnap.exists()) {
                            // Nạp dữ liệu cấu trúc mới vào
                            studyProgress = progressSnap.data().learnedCards || {};
                        }
                    } catch (progressError) {
                        console.warn('Không thể tải tiến độ, vẫn bắt đầu học với dữ liệu bộ thẻ.', progressError);
                    }
                    // Hiện nút Reset và gắn sự kiện
                    const btnReset = document.getElementById('btn-reset-progress');
                    if (btnReset) {
                        btnReset.style.display = 'inline-block';
                        btnReset.onclick = async () => {
                            if (confirm("Hành động này sẽ xóa trạng thái Đã thuộc và lịch sử Lặp lại ngắt quãng của bộ thẻ này. Bạn muốn học lại từ đầu?")) {
                                try {
                                    await deleteDoc(progressRef); // Xóa thẳng file tiến độ trên Firebase
                                    alert("Đã reset thành công!");
                                    window.location.reload(); // Tải lại trang
                                } catch (error) { console.error(error); }
                            }
                        };
                    }


                    if (data.ownerId === currentUser.uid) {
                        const btnEdit = document.getElementById('btn-edit-set');
                        btnEdit.style.display = 'inline-block';
                        btnEdit.href = `/create/?id=${setId}`;
                    }
                }

                applyStudyFilter({ shouldUpdate: false });
                updateUI();
            } else {
                showStudyEmptyState('Không tìm thấy bộ thẻ này.');
                showError("Bộ thẻ không tồn tại hoặc đã bị xóa.");
            }
        } catch (error) {
            console.error("Lỗi:", error);
            showStudyEmptyState('Không thể tải bộ thẻ.');
            showError('Không thể tải bộ thẻ. Vui lòng thử lại.');
        }
    }

    const btnRandom = document.getElementById('btn-random');
    const closeStudyFilterMenu = () => {
        if (!studyCardFilterMenu || !studyCardFilterTrigger) return;
        studyCardFilterMenu.hidden = true;
        studyCardFilterTrigger.setAttribute('aria-expanded', 'false');
    };
    studyCardFilterTrigger?.addEventListener('click', () => {
        const shouldOpen = studyCardFilterMenu.hidden;
        studyCardFilterMenu.hidden = !shouldOpen;
        studyCardFilterTrigger.setAttribute('aria-expanded', String(shouldOpen));
    });
    studyCardFilterMenu?.querySelectorAll('[data-study-filter]').forEach((option) => {
        option.addEventListener('click', async () => {
            if (activeCardTransitions.has(flashcardContainer)) return;
            const nextFilter = option.dataset.studyFilter;
            studyCardFilterLabel.textContent = option.querySelector('span')?.childNodes[0]?.textContent.trim() || 'Tất cả thẻ';
            studyCardFilterMenu.querySelectorAll('[data-study-filter]').forEach((item) => {
                item.classList.toggle('is-active', item === option);
            });
            closeStudyFilterMenu();
            await transitionCardContent(flashcardContainer, () => {
                activeStudyFilter = nextFilter;
                applyStudyFilter();
            }, 'random');
            showToast(
                nextFilter === 'unlearned'
                    ? 'Đang chỉ hiển thị những thẻ chưa học.'
                    : 'Đang hiển thị tất cả thẻ trong bộ.',
                'info'
            );
        });
    });
    document.addEventListener('click', (event) => {
        if (studyCardFilter && !studyCardFilter.contains(event.target)) closeStudyFilterMenu();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeStudyFilterMenu();
    });
    const getRandomIndex = () => {
        if (wordsArray.length < 2) return currentIndex;
        let nextIndex = currentIndex;
        while (nextIndex === currentIndex) nextIndex = Math.floor(Math.random() * wordsArray.length);
        return nextIndex;
    };
    document.getElementById('btn-next').addEventListener('click', async () => {
        if (isRandomMode) {
            await transitionCardContent(flashcardContainer, () => { currentIndex = getRandomIndex(); updateUI(); }, 'random');
        } else if (currentIndex < wordsArray.length - 1) {
            await transitionCardContent(flashcardContainer, () => { currentIndex++; updateUI(); }, 'next');
        }
    });
    document.getElementById('btn-prev').addEventListener('click', async () => {
        if (isRandomMode) {
            await transitionCardContent(flashcardContainer, () => { currentIndex = getRandomIndex(); updateUI(); }, 'random');
        } else if (currentIndex > 0) {
            await transitionCardContent(flashcardContainer, () => { currentIndex--; updateUI(); }, 'previous');
        }
    });
    btnRandom.addEventListener('click', () => {
        if (wordsArray.length < 2) return showError('Bộ thẻ cần ít nhất 2 từ để học ngẫu nhiên.');
        isRandomMode = !isRandomMode;
        btnRandom.classList.toggle('is-active', isRandomMode);
        btnRandom.setAttribute('aria-pressed', String(isRandomMode));
        btnRandom.title = isRandomMode ? 'Tắt chế độ học ngẫu nhiên' : 'Bật chế độ học ngẫu nhiên';
        btnRandom.setAttribute('aria-label', btnRandom.title);
        document.getElementById('study-mode-label').textContent = isRandomMode ? 'Ngẫu nhiên' : 'Thứ tự gốc';
        showToast(isRandomMode ? 'Đã bật chế độ học ngẫu nhiên.' : 'Đã trở về thứ tự bộ thẻ.', 'info');
    });
    const progressModeButton = document.getElementById('btn-show-word-list');
    const navigationControls = document.getElementById('study-navigation-controls');
    const reviewControls = document.getElementById('study-review-controls');
    progressModeButton.addEventListener('click', () => {
        const isProgressMode = progressModeButton.getAttribute('aria-pressed') !== 'true';
        progressModeButton.setAttribute('aria-pressed', String(isProgressMode));
        progressModeButton.classList.toggle('is-active', isProgressMode);
        navigationControls.classList.toggle('is-hidden', isProgressMode);
        reviewControls.classList.toggle('is-active', isProgressMode);
        progressModeButton.title = isProgressMode ? 'Trở về chế độ chuyển thẻ' : 'Bật chế độ cập nhật tiến độ';
        showToast(isProgressMode ? 'Chế độ Tiến độ: đánh dấu Chưa nhớ hoặc Đã thuộc.' : 'Chế độ Điều hướng: chuyển thẻ trước hoặc sau.', 'info');
    });

    // --- CẬP NHẬT: LOGIC PHÂN LOẠI SM-2 KHI BẤM NÚT ---
    document.getElementById('btn-fail').addEventListener('click', () => {
        if (activeCardTransitions.has(flashcardContainer)) return;
        if (!wordsArray[currentIndex]) return;
        if (!currentUser) return requestSignIn('lưu từ vào Lặp lại ngắt quãng');
        
        // Lấy chính xác thời gian hiện tại để thẻ đáo hạn ngay lập tức
        let nextDate = new Date(); 
        
        const sourceIndex = wordsArray[currentIndex].sourceIndex;
        studyProgress[sourceIndex] = {
            status: 'reviewing',
            repetition: 0,
            interval: 0, // Sửa interval thành 0
            easeFactor: 2.5,
            nextReview: nextDate.getTime() // Lưu mốc thời gian ngay lúc này
        }; 

        saveProgress();
        if(typeof recordWordStudied === 'function') recordWordStudied(currentUser.uid);
        navigator.vibrate?.(12);
        
        if (activeStudyFilter === 'unlearned') {
            transitionCardContent(flashcardContainer, () => applyStudyFilter({ afterSourceIndex: sourceIndex }), 'next');
        } else if (currentIndex < wordsArray.length - 1) {
            transitionCardContent(flashcardContainer, () => { currentIndex++; updateUI(); }, 'next');
        } else { renderList(); }
    });
    
    document.getElementById('btn-pass').addEventListener('click', () => {
        if (activeCardTransitions.has(flashcardContainer)) return;
        if (!wordsArray[currentIndex]) return;
        if (!currentUser) return requestSignIn('lưu tiến độ học');
        // Nút "Đã thuộc" -> Đóng gói cất đi, không đưa vào SRS
        const sourceIndex = wordsArray[currentIndex].sourceIndex;
        studyProgress[sourceIndex] = {
            status: 'learned'
        }; 

        saveProgress();
        if(typeof recordWordStudied === 'function') recordWordStudied(currentUser.uid);
        navigator.vibrate?.(18);
        
        if (activeStudyFilter === 'unlearned') {
            transitionCardContent(flashcardContainer, () => applyStudyFilter({ afterSourceIndex: sourceIndex }), 'next');
        } else if (currentIndex < wordsArray.length - 1) {
            transitionCardContent(flashcardContainer, () => { currentIndex++; updateUI(); }, 'next');
        } else { renderList(); }
    });

    document.addEventListener('keydown', (e) => {
        if (activeCardTransitions.has(flashcardContainer)) return;
        if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); flashcard.classList.toggle('is-flipped'); }
        if (e.code === 'ArrowRight') document.getElementById('btn-next').click();
        if (e.code === 'ArrowLeft') document.getElementById('btn-prev').click();
        if (e.key === '1') document.getElementById('btn-fail').click();
        if (e.key === '2') document.getElementById('btn-pass').click();
    });

    onAuthStateChanged(auth, (user) => {
        loadStudyData();
    });
}   




// ==========================================
// 7. LOGIC TRANG LẶP LẠI NGẮT QUÃNG
// ==========================================
if (currentPage === 'repetition') {
    let dueCards = []; // Mảng 1: Chỉ chứa thẻ cần học NGAY LÚC NÀY
    let allUpcomingCards = []; // Mảng 2: Chứa TẤT CẢ thẻ trong SRS để vẽ danh sách
    let currentCardIndex = 0;

    const flashcard = document.getElementById('flashcard');
    const flashcardContainer = document.getElementById('fc-container');
    const srsControls = document.getElementById('srs-controls-panel');
    const counterDisplay = document.getElementById('srs-total-count');
    const overdueCountDisplay = document.getElementById('srs-overdue-count');
    const overdueMetric = document.getElementById('srs-overdue-metric');
    const srsListContainer = document.getElementById('srs-word-list-container'); 
    const srsFeedback = document.getElementById('srs-feedback');
    const srsListToggle = document.getElementById('btn-toggle-srs-list');
    const srsListContent = document.getElementById('srs-list-content');
    const srsListSummary = document.getElementById('srs-list-summary');
    const repetitionGuideModal = document.getElementById('repetition-guide-modal');

    const closeRepetitionGuide = () => { repetitionGuideModal.style.display = 'none'; };
    document.getElementById('btn-open-repetition-guide')?.addEventListener('click', () => { repetitionGuideModal.style.display = 'flex'; });
    document.getElementById('btn-close-repetition-guide')?.addEventListener('click', closeRepetitionGuide);
    repetitionGuideModal?.addEventListener('click', (event) => {
        if (event.target === repetitionGuideModal) closeRepetitionGuide();
    });

    srsListToggle.addEventListener('click', () => {
        const isExpanded = srsListToggle.getAttribute('aria-expanded') === 'true';
        srsListToggle.setAttribute('aria-expanded', String(!isExpanded));
        srsListContent.hidden = isExpanded;
    });

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

        const dueCutoff = getStartOfTomorrowTimestamp();

        allUpcomingCards.forEach((item) => {
            const card = item.wordData;
            const reviewDate = new Date(item.progress.nextReview);
            const dateString = reviewDate.toLocaleDateString('vi-VN');
            
            // SRS hoạt động theo ngày: mọi thẻ có lịch trong hôm nay đều đến hạn,
            // không phụ thuộc vào giờ mà thẻ được đánh giá ở lần trước.
            const isDue = item.progress.nextReview < dueCutoff;

            // Làm mờ những thẻ chưa đến ngày học
            const row = document.createElement('div');
            row.className = `word-list-item ${!isDue ? 'learned' : ''}`; 
            
            const statusHTML = isDue 
                ? `<span style="font-size: 12px; color: #ff5252; background: #ffebee; padding: 4px 8px; border-radius: 4px; border: 1px solid #ffcdd2;"><i class="fa-solid fa-fire"></i> Đến hạn ôn</span>`
                : `<span style="font-size: 12px; color: #4caf50; background: #e8f5e9; padding: 4px 8px; border-radius: 4px; border: 1px solid #c8e6c9;"><i class="fa-regular fa-calendar"></i> ${dateString}</span>`;

            row.innerHTML = `
                <div>
                    <h4 style="font-size:18px;">${escapeHTML(card.term)} <span style="font-size:12px; color:#777; font-weight:normal;">${escapeHTML(card.pronunciation || '')}</span></h4>
                    <p style="color:#555; font-size:14px; margin-top:5px;">${escapeHTML(card.type ? card.type + ' - ' : '')} ${escapeHTML(card.definition)}</p>
                </div>
                <div style="text-align: right; display: flex; align-items: center; gap: 10px;">
                    ${statusHTML}
                </div>
            `;
            srsListContainer.appendChild(row);
        });
        const dueCount = allUpcomingCards.filter((item) => item.progress.nextReview < dueCutoff).length;
        srsListSummary.textContent = dueCount > 0
            ? `${dueCount} thẻ cần ôn · ${allUpcomingCards.length} thẻ trong kế hoạch`
            : `Không có thẻ đến hạn · ${allUpcomingCards.length} thẻ trong kế hoạch`;
    }

    function getStartOfTodayTimestamp() {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        return startOfToday.getTime();
    }

    function getStartOfTomorrowTimestamp() {
        const startOfTomorrow = new Date();
        startOfTomorrow.setHours(0, 0, 0, 0);
        startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
        return startOfTomorrow.getTime();
    }

    function interleaveDueCards(overdueCards, todayCards) {
        const ordered = [];
        let overdueIndex = 0;
        let todayIndex = 0;

        // Ưu tiên nợ cũ, nhưng sau mỗi 4 thẻ nợ sẽ chèn một thẻ đến hạn hôm nay.
        while (overdueIndex < overdueCards.length || todayIndex < todayCards.length) {
            for (let count = 0; count < 4 && overdueIndex < overdueCards.length; count++) {
                ordered.push(overdueCards[overdueIndex++]);
            }
            if (todayIndex < todayCards.length) ordered.push(todayCards[todayIndex++]);
            if (overdueIndex >= overdueCards.length) {
                while (todayIndex < todayCards.length) ordered.push(todayCards[todayIndex++]);
            }
        }
        return ordered;
    }

    function updateDueMetrics() {
        const startOfToday = getStartOfTodayTimestamp();
        const remainingCards = dueCards.slice(currentCardIndex);
        const overdueCount = remainingCards.filter((item) => item.progress.nextReview < startOfToday).length;
        const todayCount = remainingCards.length - overdueCount;

        counterDisplay.textContent = todayCount;
        if (overdueCountDisplay) overdueCountDisplay.textContent = overdueCount;
        if (overdueMetric) overdueMetric.hidden = overdueCount === 0;
    }

    // 2. GOM THẺ VÀ TÁCH MẢNG
    async function fetchDueCards() {
        if (!currentUser) return;
        try {
            dueCards = [];
            allUpcomingCards = [];
            currentCardIndex = 0;
            const q = query(collection(db, "user_progress"), where("userId", "==", currentUser.uid));
            const querySnapshot = await getDocs(q);
            const now = new Date().getTime();
            const dueCutoff = getStartOfTomorrowTimestamp();

            // Tải các bộ thẻ song song thay vì chờ lần lượt từng bộ.
            const progressWithSets = await Promise.all(querySnapshot.docs.map(async (progressDoc) => {
                const progressData = progressDoc.data();
                if (!progressData.setId) return null;
                const setDocSnap = await getDoc(doc(db, "study_sets", progressData.setId));
                if (!setDocSnap.exists()) return null;
                return { progressData, wordsArray: normalizeVocabularyWords(setDocSnap.data().words) };
            }));

            for (const item of progressWithSets) {
                if (!item) continue;
                const { progressData, wordsArray } = item;
                const setId = progressData.setId;
                const learnedCards = progressData.learnedCards || {};

                for (const [index, pData] of Object.entries(learnedCards)) {
                    if (pData.status === 'reviewing') {
                        if (!wordsArray[index]) continue;
                        const reviewTimestamp = Number(pData.nextReview);
                        const normalizedProgress = {
                            ...pData,
                            // Bản dữ liệu cũ thiếu nextReview vẫn được đưa vào ôn thay vì biến mất khỏi lịch.
                            nextReview: Number.isFinite(reviewTimestamp) ? reviewTimestamp : now
                        };
                        const cardObj = {
                            setId: setId,
                            wordIndex: index,
                            wordData: wordsArray[index],
                            progress: normalizedProgress
                        };
                        
                        // 1. Cho vào mảng hiển thị tổng
                        allUpcomingCards.push(cardObj); 

                        // 2. Đưa mọi thẻ có lịch đến hết hôm nay vào phiên ôn.
                        if (normalizedProgress.nextReview < dueCutoff) {
                            dueCards.push(cardObj);
                        }
                    }
                }
            }

            // Nợ cũ được ưu tiên, đồng thời xen kẽ thẻ đến hạn hôm nay để nhịp ôn luôn cân bằng.
            const startOfToday = getStartOfTodayTimestamp();
            const overdueCards = dueCards.filter((item) => item.progress.nextReview < startOfToday)
                .sort((a, b) => a.progress.nextReview - b.progress.nextReview);
            const todayCards = dueCards.filter((item) => item.progress.nextReview >= startOfToday)
                .sort((a, b) => a.progress.nextReview - b.progress.nextReview);
            dueCards = interleaveDueCards(overdueCards, todayCards);
            allUpcomingCards.sort((a, b) => a.progress.nextReview - b.progress.nextReview);
            
            updateUI();
            renderSRSList(); 

        } catch (error) {
            console.error("Lỗi tải thẻ SRS:", error);
        }
    }

    // 3. CẬP NHẬT THẺ 3D
    function updateUI() {
        updateDueMetrics();
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
            (typePron ? `<span style="font-size: 16px; color: #777; font-weight: normal; display: block; margin-bottom: 8px;">${escapeHTML(typePron)}</span>` : '') +
            escapeHTML(card.definition);
        
        const synElement = document.getElementById('fc-back-syn');
        if (card.synonyms) { synElement.textContent = card.synonyms.replace(/,/g, ';'); synElement.style.display = 'block'; } 
        else { synElement.style.display = 'none'; }

        const exElement = document.getElementById('fc-back-ex');
        if (card.example) { exElement.textContent = card.example; exElement.style.display = 'block'; } 
        else { exElement.style.display = 'none'; }
    }

    // 4. XỬ LÝ KHI ĐÁNH GIÁ THẺ
    async function processEvaluation(quality, selectedButton = null) {
        if (currentCardIndex >= dueCards.length) return;
        const ratingLabels = { 0: 'Quên', 3: 'Khó', 4: 'Tốt', 5: 'Dễ' };
        const button = selectedButton || document.getElementById(`btn-sm2-${quality}`);
        document.querySelectorAll('.btn-srs').forEach((btn) => { btn.disabled = true; });
        button?.classList.add('is-processing');
        if (srsFeedback) {
            srsFeedback.textContent = `Đã chọn “${ratingLabels[quality]}” — đang lưu đánh giá…`;
            srsFeedback.classList.add('is-visible');
        }
        const currentData = dueCards[currentCardIndex];
        const newProgress = calculateSM2(quality, currentData.progress);
        
        try {
            const progressRef = doc(db, "user_progress", `${currentUser.uid}_${currentData.setId}`);
            const snap = await getDoc(progressRef);
            let allLearnedCards = snap.exists() ? snap.data().learnedCards : {};
            
            allLearnedCards[currentData.wordIndex] = newProgress;
            await updateDoc(progressRef, { learnedCards: allLearnedCards });
        } catch (error) {
            console.error("Lỗi lưu SM-2:", error);
            if (srsFeedback) srsFeedback.textContent = 'Chưa thể lưu đánh giá. Vui lòng thử lại.';
            document.querySelectorAll('.btn-srs').forEach((btn) => {
                btn.disabled = false;
                btn.classList.remove('is-processing');
            });
            return;
        }

        // Chỉ cập nhật giao diện sau khi Firebase đã lưu thành công.
        const upcomingIndex = allUpcomingCards.findIndex(c => c.setId === currentData.setId && c.wordIndex === currentData.wordIndex);
        if (upcomingIndex !== -1) {
            allUpcomingCards[upcomingIndex].progress = newProgress;
        }
        allUpcomingCards.sort((a, b) => a.progress.nextReview - b.progress.nextReview);

        await transitionCardContent(flashcardContainer, () => {
            // Reset phép lật khi thẻ đang hoàn toàn ẩn rồi mới gắn nội dung mới.
            flashcard.classList.add('is-resetting');
            flashcard.classList.remove('is-flipped');
            void flashcard.offsetWidth;
            currentCardIndex++;
            recordLearningActivity(currentUser.uid, 'reviewed');
            updateUI();
            flashcard.classList.remove('is-resetting');
        }, 'next');
        renderSRSList(); // Chạy lại hàm vẽ để thay đổi nhãn đỏ thành xanh
        if (srsFeedback) {
            srsFeedback.textContent = currentCardIndex < dueCards.length
                ? `Đã ghi nhận “${ratingLabels[quality]}”. Hãy tiếp tục với từ tiếp theo.`
                : 'Đã ghi nhận đánh giá. Bạn đã hoàn thành lượt ôn hôm nay!';
        }
        document.querySelectorAll('.btn-srs').forEach((btn) => {
            btn.disabled = false;
            btn.classList.remove('is-processing');
        });
    }

    document.getElementById('btn-sm2-0').addEventListener('click', (event) => processEvaluation(0, event.currentTarget));
    document.getElementById('btn-sm2-3').addEventListener('click', (event) => processEvaluation(3, event.currentTarget));
    document.getElementById('btn-sm2-4').addEventListener('click', (event) => processEvaluation(4, event.currentTarget));
    document.getElementById('btn-sm2-5').addEventListener('click', (event) => processEvaluation(5, event.currentTarget));

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
        else { alert("Vui lòng đăng nhập!"); navigateTo("/"); }
    });
}



// ==========================================
// 8. LOGIC TRANG TRẮC NGHIỆM
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
    let quizInitialized = false;

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
    function shuffleQuizItems(items) {
        for (let index = items.length - 1; index > 0; index--) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
        }
        return items;
    }

    function generateDistractors(correctWord, poolToPick, answerField) {
        const correctAnswer = textValue(correctWord[answerField]).toLocaleLowerCase('vi-VN');
        const seenAnswers = new Set([correctAnswer]);
        const available = shuffleQuizItems(poolToPick.filter((word) => {
            const answer = textValue(word[answerField]).toLocaleLowerCase('vi-VN');
            if (!answer || seenAnswers.has(answer)) return false;
            seenAnswers.add(answer);
            return true;
        }));
        const options = [correctWord];
        
        if (correctWord.type) {
            let sameType = available.filter(w => w.type === correctWord.type);
            while(options.length < 4 && sameType.length > 0) {
                options.push(sameType.pop());
                const selected = options[options.length - 1];
                const selectedIndex = available.indexOf(selected);
                if (selectedIndex >= 0) available.splice(selectedIndex, 1);
            }
        }

        while(options.length < 4 && available.length > 0) {
            options.push(available.pop());
        }
        return options.length === 4 ? shuffleQuizItems(options) : [];
    }

    function showQuizError(message) {
        document.getElementById('quiz-question-text').textContent = 'Chưa thể tạo câu hỏi';
        const hint = document.getElementById('quiz-question-hint');
        hint.textContent = message;
        hint.style.display = 'block';
        document.getElementById('quiz-options-grid').innerHTML = '';
        actionBar.style.display = 'none';
        audioButton.classList.remove('visible');
    }

    // 2. KHỞI TẠO BÀI THI
    async function initQuiz() {
        if (!setId) return alert("Lỗi ID bộ thẻ!");
        if (quizInitialized) return;
        try {
            const docSnap = await getDoc(doc(db, "study_sets", setId));
            if (!docSnap.exists()) return alert("Bộ thẻ không tồn tại.");
            const setData = docSnap.data();
            if (!currentUser && setData.isPublic !== true) {
                requestSignIn('làm trắc nghiệm với bộ thẻ riêng tư');
                navigateTo('/');
                return;
            }
            quizInitialized = true;
            // Bộ thẻ cũ có thể lưu các khóa như english/vietnamese hoặc def/meaning.
            // Chuẩn hóa trước khi tạo Quiz để một thẻ lỗi không làm cả phiên bị kẹt.
            allWordsInSet = (Array.isArray(setData.words) ? setData.words : [])
                .map((word, index) => {
                    const normalized = normalizeVocabularyWord(word);
                    return normalized ? { ...normalized, originalIndex: index } : null;
                })
                .filter(Boolean);

            if(allWordsInSet.length < 4) {
                showQuizError('Bộ thẻ cần ít nhất 4 từ có đủ thuật ngữ và định nghĩa để làm trắc nghiệm.');
                return;
            }

            let learnedStatus = {};
            // Luyện toàn bộ từ không cần tải SRS. Nhờ vậy một dữ liệu tiến độ cũ/lỗi
            // sẽ không thể chặn toàn bộ bài Quiz của bộ thẻ.
            if (currentUser && filterType !== 'all') {
                try {
                    const progSnap = await getDoc(doc(db, "user_progress", `${currentUser.uid}_${setId}`));
                    const savedCards = progSnap.exists() ? progSnap.data().learnedCards : null;
                    learnedStatus = savedCards && typeof savedCards === 'object' ? savedCards : {};
                } catch (progressError) {
                    console.warn('Không thể đọc tiến độ Quiz, dùng dữ liệu mặc định:', progressError);
                    learnedStatus = {};
                }
            }

            // Gắn originalIndex để biết từ này nằm ở đâu trong mảng gốc
            allWordsInSet.forEach((word) => {
                const isLearned = learnedStatus[word.originalIndex] && learnedStatus[word.originalIndex].status === 'learned';
                const wordObj = { wordData: word, originalIndex: word.originalIndex };
                
                if (filterType === 'all') quizPool.push(wordObj);
                else if (filterType === 'learned' && isLearned) quizPool.push(wordObj);
                else if (filterType === 'unlearned' && !isLearned) quizPool.push(wordObj);
            });

            if (quizPool.length === 0) {
                showQuizError('Không có từ vựng nào khớp với bộ lọc đã chọn.');
                return;
            }

            quizPool = shuffleQuizItems(quizPool);
            if (limit !== 'all' && quizPool.length > parseInt(limit)) {
                quizPool = quizPool.slice(0, parseInt(limit));
            }

            questions = quizPool.map((item) => {
                try {
                const preferredMode = mode === 'mixed' ? (Math.random() > 0.5 ? 'en-vi' : 'vi-en') : mode;
                const buildQuestion = (qMode) => {
                    const answerField = qMode === 'en-vi' ? 'definition' : 'term';
                    const options = generateDistractors(item.wordData, allWordsInSet, answerField);
                    return options.length === 4 ? { mode: qMode, correctWord: item.wordData, originalIndex: item.originalIndex, options } : null;
                };
                return buildQuestion(preferredMode) || (mode === 'mixed'
                    ? buildQuestion(preferredMode === 'en-vi' ? 'vi-en' : 'en-vi')
                    : null);
                } catch (questionError) {
                    console.warn('Bỏ qua một thẻ không thể tạo câu hỏi:', questionError);
                    return null;
                }
            }).filter(Boolean);

            if (!questions.length) {
                showQuizError('Bộ thẻ chưa có đủ 4 đáp án khác nhau để tạo câu hỏi. Hãy bổ sung thêm từ hoặc định nghĩa.');
                return;
            }

            renderQuestion();
        } catch (e) {
            console.error("Lỗi khởi tạo Quiz:", e);
            showQuizError('Đã xảy ra lỗi khi đọc dữ liệu bộ thẻ. Vui lòng thử lại hoặc kiểm tra lại các thẻ từ.');
        }
    }

    // 3. VẼ CÂU HỎI
    function handleQuizAnswer(isCorrect, correctAnswer) {
        if (hasAnsweredCurrentQuestion) return;
        hasAnsweredCurrentQuestion = true;
        if (isCorrect) {
            score++;
            currentStreak++;
            bestStreak = Math.max(bestStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
        document.getElementById('quiz-score-live').textContent = score;
        document.getElementById('quiz-streak').textContent = currentStreak;
        feedback.className = `quiz-feedback ${isCorrect ? 'is-correct' : 'is-wrong'}`;
        feedback.innerHTML = isCorrect
            ? '<i class="fa-solid fa-circle-check"></i><span><strong>Chính xác!</strong> Bạn đã trả lời đúng.</span>'
            : `<i class="fa-solid fa-circle-xmark"></i><span><strong>Chưa chính xác.</strong> Đáp án đúng: ${escapeHTML(correctAnswer)}</span>`;
        actionBar.style.display = 'flex';
    }

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
        document.querySelector('.quiz-question-label').textContent = 'Chọn đáp án chính xác';

        qData.options.forEach((opt, optionIndex) => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option-btn';
            btn.innerHTML = `<span>${escapeHTML(isEnToVi ? opt.definition : opt.term)}</span><span class="quiz-option-key">${String.fromCharCode(65 + optionIndex)}</span>`;
            btn.dataset.optionIndex = optionIndex;
            
            btn.addEventListener('click', () => {
                document.querySelectorAll('.quiz-option-btn').forEach(b => b.classList.add('disabled'));

                const isCorrect = opt === qData.correctWord;
                if (isCorrect) {
                    btn.classList.add('correct');
                } else {
                    btn.classList.add('wrong');
                    document.querySelectorAll('.quiz-option-btn').forEach(b => {
                        if (Number(b.dataset.optionIndex) === qData.options.indexOf(qData.correctWord)) b.classList.add('correct');
                    });
                }
                handleQuizAnswer(isCorrect, isEnToVi ? qData.correctWord.definition : qData.correctWord.term);
            });
            grid.appendChild(btn);
        });
    }

    // 4. CẬP NHẬT TIẾN ĐỘ TRỰC TIẾP TỪ QUIZ
    async function updateWordStatus(statusType, btnElement) {
        if (!currentUser) return requestSignIn(statusType === 'reviewing' ? 'đưa từ vào Lặp lại ngắt quãng' : 'lưu từ đã thuộc');
        const qData = questions[currentQuestionIndex];
        const progressRef = doc(db, "user_progress", `${currentUser.uid}_${setId}`);
        
        btnElement.innerHTML = brandButtonLoading('Đang lưu...');
        
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
            
            btnElement.innerHTML = statusType === 'learned' ? '<i class="fa-solid fa-check-double"></i> Đã lưu vào Đã thuộc' : '<i class="fa-solid fa-check-double"></i> Đã đưa vào Lặp lại ngắt quảng';
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

    document.getElementById('btn-quit-quiz').addEventListener('click', () => navigateTo(`/study/?id=${setId}`));
    document.getElementById('btn-back-to-study').addEventListener('click', () => navigateTo(`/study/?id=${setId}`));
    document.getElementById('btn-replay').addEventListener('click', () => window.location.reload());

    onAuthStateChanged(auth, (user) => {
        initQuiz();
    });
}
