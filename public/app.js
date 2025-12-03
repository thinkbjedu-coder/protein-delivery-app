const API_BASE = '/api';
let deliveries = [];

const loginOverlay = document.getElementById('loginOverlay');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');
const appContainer = document.getElementById('appContainer');
const deliveryList = document.getElementById('deliveryList');
const entryModal = document.getElementById('entryModal');
const newEntryBtn = document.getElementById('newEntryBtn');
const closeEntryModalBtn = document.getElementById('closeEntryModal');
const cancelEntryBtn = document.getElementById('cancelEntryBtn');
const entryForm = document.getElementById('entryForm');
const receiveModal = document.getElementById('receiveModal');
const closeReceiveModalBtn = document.getElementById('closeReceiveModal');
const cancelReceiveBtn = document.getElementById('cancelReceiveBtn');
const receiveForm = document.getElementById('receiveForm');
const receiveIdInput = document.getElementById('receiveId');
const receiverNameInput = document.getElementById('receiverName');
const filterStatus = document.getElementById('filterStatus');
const filterSite = document.getElementById('filterSite');
const exportCsvBtn = document.getElementById('exportCsvBtn');

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        showApp();
    }
    setupEventListeners();
    populateSiteFilter();
});

function setupEventListeners() {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = passwordInput.value;
        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await res.json();
            if (data.success) {
                sessionStorage.setItem('isLoggedIn', 'true');
                showApp();
            } else {
                loginError.textContent = 'パスワードが違います';
            }
        } catch (err) {
            console.error(err);
            loginError.textContent = 'サーバーエラー';
        }
    });

    newEntryBtn.addEventListener('click', () => entryModal.classList.add('active'));
    closeEntryModalBtn.addEventListener('click', () => entryModal.classList.remove('active'));
    cancelEntryBtn.addEventListener('click', () => entryModal.classList.remove('active'));

    // Improve Form Usability
    const checkboxes = entryForm.querySelectorAll('input[name="item"]');
    checkboxes.forEach(cb => {
        const qtyInput = cb.parentElement.querySelector('.qty-input');

        // 1. Auto-focus quantity when checkbox is checked
        cb.addEventListener('change', () => {
            if (cb.checked) {
                qtyInput.focus();
            }
        });

        // 2. Auto-check checkbox when quantity is entered
        qtyInput.addEventListener('input', () => {
            if (parseInt(qtyInput.value) > 0) {
                cb.checked = true;
            }
        });
    });

    entryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(entryForm);
        const to_site = formData.get('to_site');
        const note = formData.get('note');
        const items = [];
        const checkboxes = entryForm.querySelectorAll('input[name="item"]');
        checkboxes.forEach((cb) => {
            if (cb.checked) {
                const qtyInput = cb.parentElement.querySelector('.qty-input');
                const qty = parseInt(qtyInput.value) || 0;
                if (qty > 0) {
                    items.push({ item: cb.value, qty });
                }
            }
        });

        const entryError = document.getElementById('entryError');
        entryError.textContent = '';

        // DEBUG LOGGING
        let debugMsg = `Items found: ${items.length}\n`;
        checkboxes.forEach((cb, idx) => {
            if (cb.checked) {
                const qtyInput = cb.parentElement.querySelector('.qty-input');
                debugMsg += `Checked: ${cb.value}, Qty: ${qtyInput.value}\n`;
            }
        });
        if (items.length === 0) {
            entryError.textContent = debugMsg + '❌ 品目を1つ以上選択し、数量（1以上）を入力してください';
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/deliveries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to_site, items, note })
            });
            if (res.ok) {
                entryModal.classList.remove('active');
                entryForm.reset();
                fetchDeliveries();
            } else {
                const data = await res.json();
                entryError.textContent = `エラーが発生しました: ${data.error || res.statusText}`;
            }
        } catch (err) {
            console.error(err);
            entryError.textContent = `サーバー接続エラー: ${err.message}`;
        }
    });

    closeReceiveModalBtn.addEventListener('click', () => receiveModal.classList.remove('active'));
    cancelReceiveBtn.addEventListener('click', () => receiveModal.classList.remove('active'));

    receiveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = receiveIdInput.value;
        const receiver_name = receiverNameInput.value;
        try {
            const res = await fetch(`${API_BASE}/deliveries/${id}/receive`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receiver_name })
            });
            if (res.ok) {
                receiveModal.classList.remove('active');
                receiveForm.reset();
                fetchDeliveries();
            } else {
                alert('更新に失敗しました');
            }
        } catch (err) {
            console.error(err);
            alert('サーバーエラー');
        }
    });

    filterStatus.addEventListener('change', renderDeliveries);
    filterSite.addEventListener('change', renderDeliveries);
    exportCsvBtn.addEventListener('click', () => {
        // Create a temporary anchor tag for download
        const link = document.createElement('a');
        link.href = `${API_BASE}/export/csv`;
        link.download = 'deliveries.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

function showApp() {
    loginOverlay.style.display = 'none';
    appContainer.style.display = 'block';
    fetchDeliveries();
}

async function fetchDeliveries() {
    try {
        const res = await fetch(`${API_BASE}/deliveries`);
        if (res.ok) {
            deliveries = await res.json();
            renderDeliveries();
        }
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

function renderDeliveries() {
    const statusFilter = filterStatus.value;
    const siteFilter = filterSite.value;
    const filtered = deliveries.filter(d => {
        if (statusFilter && d.status !== statusFilter) return false;
        if (siteFilter && d.to_site !== siteFilter) return false;
        return true;
    });

    deliveryList.innerHTML = filtered.map(d => {
        const isReceived = d.received_check === 1;
        const statusClass = isReceived ? 'status-received' : 'status-created';
        const checkIcon = isReceived ? '<i class="fa-solid fa-check"></i>' : '';
        const checkClass = isReceived ? 'checked' : '';
        const disabled = isReceived ? 'disabled' : '';
        const itemsDisplay = (d.items || []).map(i => `${i.item} (${i.qty}袋)`).join('<br>');

        return `
            <div class="delivery-item">
                <div style="font-family: monospace;">${d.id}</div>
                <div><span class="status-badge ${statusClass}">${d.status}</span></div>
                <div>${d.to_site}</div>
                <div style="line-height: 1.6;">${itemsDisplay}</div>
                <div>
                    <button class="check-btn ${checkClass}" ${disabled} onclick="openReceiveModal('${d.id}')">
                        ${checkIcon}
                    </button>
                </div>
                <div>
                    ${d.received_at || '-'}
                    ${d.receiver_name ? `<br><small style="color:var(--text-muted)">${d.receiver_name}</small>` : ''}
                </div>
                <div>
                    <button class="btn-delete" onclick="deleteDelivery('${d.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

window.openReceiveModal = (id) => {
    const d = deliveries.find(item => item.id === id);
    if (d && d.received_check === 1) return;
    receiveIdInput.value = id;
    receiveModal.classList.add('active');
    setTimeout(() => receiverNameInput.focus(), 100);
};

window.deleteDelivery = async (id) => {
    console.log('[DELETE] Step 1: Attempting to delete:', id);
    const confirmed = confirm('この伝票を削除しますか？');
    console.log('[DELETE] Step 2: User confirmed:', confirmed);
    if (!confirmed) {
        console.log('[DELETE] Step 3: User cancelled');
        return;
    }
    console.log('[DELETE] Step 4: Starting fetch request to:', `${API_BASE}/deliveries/${id}`);
    try {
        const res = await fetch(`${API_BASE}/deliveries/${id}`, { method: 'DELETE' });
        console.log('[DELETE] Step 5: Received response:', res.status, res.statusText);
        if (res.ok) {
            console.log('[DELETE] Step 6: Delete successful, refreshing list');
            await fetchDeliveries();
            console.log('[DELETE] Step 7: List refreshed');
        } else {
            const data = await res.json();
            console.error('[DELETE] Step 6: Delete failed:', data);
            alert(`削除に失敗しました: ${data.error || res.statusText}`);
        }
    } catch (err) {
        console.error('[DELETE] Error in fetch:', err);
        alert(`サーバーエラー: ${err.message}`);
    }
};

function populateSiteFilter() {
    const sites = [
        "リハビリフィットネス大永寺", "リハビリフィットネス守山", "リハビリフィットネス旭", "リハビリフィットネス長久手",
        "Co.メディカルフィットネス旭", "Life Up 可児", "Think Life守山", "Think Life大曽根", "Think Life旭",
        "Life Up 訪問看護ステーション可児", "訪問看護ステーション守山", "訪問看護ステーション旭"
    ];
    sites.forEach(site => {
        const option = document.createElement('option');
        option.value = site;
        option.textContent = site;
        filterSite.appendChild(option);
    });
}
