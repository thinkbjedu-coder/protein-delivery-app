// 環境に応じてAPI_BASEを自動設定
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `http://${window.location.hostname}:${window.location.port || 3000}/api`
    : `${window.location.origin}/api`;

// パスワード設定
const CORRECT_PASSWORD = '0305';
const AUTH_TOKEN_KEY = 'delivery_app_auth';

let currentReceiveId = null; // 受領確認中のID

document.addEventListener('DOMContentLoaded', () => {
    // 認証チェック
    checkAuth();

    // ログインフォーム
    const loginForm = document.getElementById('login-form');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = passwordInput.value;

        if (password === CORRECT_PASSWORD) {
            // 認証成功
            sessionStorage.setItem(AUTH_TOKEN_KEY, 'authenticated');
            showApp();
            passwordInput.value = '';
            loginError.style.display = 'none';
        } else {
            // 認証失敗
            loginError.textContent = 'パスワードが正しくありません';
            loginError.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();
        }
    });

    logoutBtn.addEventListener('click', () => {
        if (confirm('ログアウトしますか?')) {
            sessionStorage.removeItem(AUTH_TOKEN_KEY);
            hideApp();
        }
    });

    // Elements
    const navTabs = document.querySelectorAll('.nav-tab');
    const createView = document.querySelector('.create-view');
    const historyView = document.querySelector('.history-view');
    const receiveView = document.querySelector('.receive-view');

    const fromBranchSelect = document.getElementById('from-branch-select');
    const toBranchSelect = document.getElementById('to-branch-select');
    const filterBranchSelect = document.getElementById('filter-branch');
    const currentDateEl = document.getElementById('current-date');
    const itemList = document.getElementById('item-list');
    const addItemBtn = document.getElementById('add-item-btn');
    const saveBtn = document.getElementById('save-btn');
    const noteInput = document.getElementById('note-input');
    const printBtn = document.getElementById('print-btn');

    const filterStatusSelect = document.getElementById('filter-status');
    const filterSearchInput = document.getElementById('filter-search');
    const applyFilterBtn = document.getElementById('apply-filter-btn');
    const historyTbody = document.getElementById('history-tbody');
    const noHistory = document.getElementById('no-history');

    const receiveFilterBranchSelect = document.getElementById('receive-filter-branch');
    const receiveFilterSearchInput = document.getElementById('receive-filter-search');
    const applyReceiveFilterBtn = document.getElementById('apply-receive-filter-btn');
    const receiveTbody = document.getElementById('receive-tbody');
    const noReceive = document.getElementById('no-receive');

    const detailModal = document.getElementById('detail-modal');
    const modalBody = document.getElementById('modal-body');
    const modalClose = document.querySelector('.modal-close');

    const receiverModal = document.getElementById('receiver-modal');
    const receiverName = document.getElementById('receiver-name');
    const modalCloseReceiver = document.querySelector('.modal-close-receiver');
    const confirmReceiveBtn = document.getElementById('confirm-receive-btn');

    const printTitle = document.getElementById('print-title');
    const printDate = document.getElementById('print-date');
    const printBranch = document.getElementById('print-branch');
    const printItemsBody = document.getElementById('print-items-body');

    // Initialize
    function init() {
        loadBranches();
        updateDate();
        addItemRow();
        setupEventListeners();
    }

    // 認証チェック
    function checkAuth() {
        const isAuthenticated = sessionStorage.getItem(AUTH_TOKEN_KEY) === 'authenticated';
        if (isAuthenticated) {
            showApp();
        } else {
            hideApp();
        }
    }

    // アプリケーションを表示
    function showApp() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        init();
    }

    // アプリケーションを非表示
    function hideApp() {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }

    // Event Listeners
    function setupEventListeners() {
        if (navTabs) {
            navTabs.forEach(tab => {
                tab.addEventListener('click', () => switchView(tab.dataset.view));
            });
        }

        if (addItemBtn) addItemBtn.addEventListener('click', addItemRow);
        if (saveBtn) saveBtn.addEventListener('click', saveDelivery);
        if (printBtn) printBtn.addEventListener('click', printDelivery);
        if (applyFilterBtn) applyFilterBtn.addEventListener('click', loadHistory);
        if (applyReceiveFilterBtn) applyReceiveFilterBtn.addEventListener('click', loadReceiveList);
        if (modalClose) modalClose.addEventListener('click', closeModal);
        if (modalCloseReceiver) modalCloseReceiver.addEventListener('click', closeReceiverModal);
        if (confirmReceiveBtn) confirmReceiveBtn.addEventListener('click', window.confirmReceive);

        if (detailModal) {
            detailModal.addEventListener('click', (e) => {
                if (e.target === detailModal) closeModal();
            });
        }

        if (receiverModal) {
            receiverModal.addEventListener('click', (e) => {
                if (e.target === receiverModal) closeReceiverModal();
            });
        }
    }

    // View Switching
    function switchView(view) {
        navTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === view);
        });

        document.querySelectorAll('.app-main').forEach(el => {
            el.style.display = 'none';
        });

        document.querySelector(`.${view}-view`).style.display = 'block';

        // Auto-load data based on view
        if (view === 'history') {
            loadHistory();
        } else if (view === 'receive') {
            loadReceiveList();
        }
    }

    // Load Branches
    async function loadBranches() {
        try {
            const response = await fetch(`${API_BASE}/branches`);
            const branches = await response.json();

            branches.forEach(branch => {
                // toBranchSelect, filterBranchSelect, receiveFilterBranchSelect は select 要素
                const optionTo = document.createElement('option');
                optionTo.value = branch;
                optionTo.textContent = branch;

                const optionFilter = document.createElement('option');
                optionFilter.value = branch;
                optionFilter.textContent = branch;

                const optionReceiveFilter = document.createElement('option');
                optionReceiveFilter.value = branch;
                optionReceiveFilter.textContent = branch;

                if (toBranchSelect) toBranchSelect.appendChild(optionTo);
                if (filterBranchSelect) filterBranchSelect.appendChild(optionFilter);
                if (receiveFilterBranchSelect) receiveFilterBranchSelect.appendChild(optionReceiveFilter);

                // fromBranchSelect は input 要素の場合があるため、select の場合のみ appendChild する
                if (fromBranchSelect && fromBranchSelect.tagName === 'SELECT') {
                    const optionFrom = document.createElement('option');
                    optionFrom.value = branch;
                    optionFrom.textContent = branch;
                    if (branch === '本部') {
                        optionFrom.selected = true;
                    }
                    fromBranchSelect.appendChild(optionFrom);
                } else if (fromBranchSelect && fromBranchSelect.tagName === 'INPUT') {
                    // input の場合は値を固定 (HTML側で設定されているはずだが念のため)
                    if (branch === '本部') {
                        fromBranchSelect.value = '本部';
                    }
                }
            });
        } catch (error) {
            console.error('Error loading branches:', error);
        }
    }

    // Update Date
    function updateDate() {
        const now = new Date();
        const y = now.getFullYear();
        const m = (now.getMonth() + 1).toString().padStart(2, '0');
        const d = now.getDate().toString().padStart(2, '0');
        const day = ['日', '月', '火', '水', '木', '金', '土'][now.getDay()];
        const dateStr = `${y}/${m}/${d}(${day})`;
        if (currentDateEl) currentDateEl.textContent = dateStr;
    }

    // Add Item Row
    function addItemRow() {
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
            <select class="item-name">
                <option value="" disabled selected>品名を選択</option>
                <option value="base（ココア）">base（ココア）</option>
                <option value="base（ほうじ茶）">base（ほうじ茶）</option>
                <option value="アルミオ">アルミオ</option>
                <option value="ソウル（日向夏）">ソウル（日向夏）</option>
                <option value="ソウル（ストロベリー）">ソウル（ストロベリー）</option>
                <option value="マッスル">マッスル</option>
            </select>
            <select class="item-qty">
                ${Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
            </select>
            <button class="btn-remove" title="削除">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        row.querySelector('.btn-remove').addEventListener('click', () => {
            if (itemList.children.length > 1) {
                row.remove();
            } else {
                row.querySelector('.item-name').value = '';
                row.querySelector('.item-qty').value = '1';
            }
        });

        itemList.appendChild(row);
    }

    // Save Delivery
    async function saveDelivery() {
        const fromBranch = "本部";
        const toBranch = toBranchSelect.value;
        const type = "納品書"; // Fixed as requested
        const date = currentDateEl.textContent;
        const note = noteInput.value;

        if (!toBranch) {
            alert('入庫先を選択してください');
            return;
        }

        const items = [];
        const rows = itemList.querySelectorAll('.item-row');

        rows.forEach(row => {
            const name = row.querySelector('.item-name').value;
            const quantity = parseInt(row.querySelector('.item-qty').value);
            if (name) {
                items.push({ name, quantity });
            }
        });

        if (items.length === 0) {
            alert('品名を選択してください');
            return;
        }

        const itemsText = items.map(item => `${item.name} × ${item.quantity}袋`).join('\n');
        const confirmMessage = `以下の内容で保存します。よろしいですか?\n\n送付先: ${toBranch}\n\n品目:\n${itemsText}`;

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/deliveries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    fromBranch,
                    toBranch,
                    type,
                    items,
                    note
                })
            });

            const result = await response.json();

            if (response.ok) {
                alert('納品書を保存しました');
                // Clear form
                toBranchSelect.value = '';
                noteInput.value = '';
                itemList.innerHTML = '';
                addItemRow();
            } else {
                alert('エラー: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving delivery:', error);
            alert('サーバーに接続できません。');
        }
    }

    // Print Delivery
    function printDelivery() {
        const toBranch = toBranchSelect.value;
        const note = noteInput.value;

        if (!toBranch) {
            alert('入庫先を選択してください');
            return;
        }

        // printTitle.textContent = "納品書";
        printDate.textContent = currentDateEl.textContent;
        printBranch.textContent = toBranch;

        if (note) {
            printNoteContent.textContent = note;
            printNoteArea.style.display = 'block';
        } else {
            printNoteArea.style.display = 'none';
        }

        printItemsBody.innerHTML = '';
        const rows = itemList.querySelectorAll('.item-row');
        let hasItems = false;

        rows.forEach((row, index) => {
            const name = row.querySelector('.item-name').value;
            const qty = row.querySelector('.item-qty').value;

            if (name) {
                hasItems = true;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${name}</td>
                    <td>${qty} 袋</td>
                    <td><div class="box-small"></div></td>
                `;
                printItemsBody.appendChild(tr);
            }
        });

        if (!hasItems) {
            alert('品名を選択してください');
            return;
        }

        window.print();
    }

    // Load History
    async function loadHistory() {
        const filters = {
            branch: filterBranchSelect ? filterBranchSelect.value : '',
            status: filterStatusSelect ? filterStatusSelect.value : '',
            search: filterSearchInput ? filterSearchInput.value : ''
        };

        try {
            const params = new URLSearchParams();
            if (filters.branch) params.append('branch', filters.branch);
            if (filters.status) params.append('status', filters.status);
            if (filters.search) params.append('search', filters.search);

            const response = await fetch(`${API_BASE}/deliveries?${params}`);
            if (!response.ok) {
                throw new Error(`サーバーエラー (${response.status})`);
            }
            const deliveries = await response.json();

            if (!Array.isArray(deliveries)) {
                console.error('Expected array but got:', deliveries);
                throw new Error('データ形式が不正です');
            }

            renderHistory(deliveries);
        } catch (error) {
            console.error('Error loading history:', error);
            // エラー時も空のデータとして表示
            renderHistory([]);
            // ユーザーフレンドリーなエラーメッセージ
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                alert('サーバーに接続できません。ネットワーク接続を確認してください。');
            } else {
                alert(`履歴の読み込みに失敗しました: ${error.message}`);
            }
        }
    }

    // Render History
    function renderHistory(deliveries) {
        historyTbody.innerHTML = '';

        if (deliveries.length === 0) {
            noHistory.style.display = 'block';
            return;
        }

        noHistory.style.display = 'none';

        deliveries.forEach(delivery => {
            const tr = document.createElement('tr');
            const statusClass = delivery.status === 'received' ? 'status-received' : 'status-sent';
            const statusText = delivery.status === 'received' ? '受領済み' : '作成済み';
            const itemsText = Array.isArray(delivery.items)
                ? delivery.items.map(i => `${i.name}(${i.quantity})`).join(', ')
                : (delivery.items || '-');

            const receivedDate = delivery.received_at
                ? new Date(delivery.received_at).toLocaleDateString()
                : '-';

            const tdDate = document.createElement('td');
            tdDate.setAttribute('data-label', '日付');
            tdDate.textContent = delivery.date;

            const tdBranch = document.createElement('td');
            tdBranch.setAttribute('data-label', '入庫先');
            tdBranch.textContent = delivery.to_branch;

            const tdItems = document.createElement('td');
            tdItems.setAttribute('data-label', '品目');
            tdItems.innerHTML = `<div class="truncate-text" title="${itemsText}">${itemsText}</div>`;

            const tdStatus = document.createElement('td');
            tdStatus.setAttribute('data-label', '状態');
            tdStatus.innerHTML = `<span class="status-badge ${statusClass}">${statusText}</span>`;

            const tdReceivedDate = document.createElement('td');
            tdReceivedDate.setAttribute('data-label', '受領日');
            tdReceivedDate.textContent = receivedDate;

            const tdAction = document.createElement('td');
            tdAction.setAttribute('data-label', '操作');
            tdAction.innerHTML = `
                <button class="btn btn-small btn-secondary-action" onclick="viewDetail(${delivery.id})">詳細</button>
                <button class="btn btn-small btn-danger" onclick="deleteDelivery(${delivery.id})">削除</button>
            `;

            tr.appendChild(tdDate);
            tr.appendChild(tdBranch);
            tr.appendChild(tdItems);
            tr.appendChild(tdStatus);
            tr.appendChild(tdReceivedDate);
            tr.appendChild(tdAction);
            historyTbody.appendChild(tr);
        });
    }

    // Load Receive List
    async function loadReceiveList() {
        const filters = {
            branch: receiveFilterBranchSelect ? receiveFilterBranchSelect.value : '',
            status: 'sent', // Only show unreceived
        };

        try {
            const params = new URLSearchParams();
            if (filters.branch) params.append('branch', filters.branch);
            params.append('status', filters.status);

            console.log('Fetching receive list with params:', params.toString());
            const response = await fetch(`${API_BASE}/deliveries?${params}`);
            console.log('Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('Server error response:', errorData);
                throw new Error(`サーバーエラー (${response.status}): ${errorData.error || 'Unknown error'}`);
            }
            const deliveries = await response.json();
            console.log('Received deliveries:', deliveries);

            if (!Array.isArray(deliveries)) {
                console.error('Expected array but got:', deliveries);
                throw new Error('データ形式が不正です');
            }

            renderReceiveList(deliveries);
        } catch (error) {
            console.error('Error loading receive list:', error);
            // エラー時も空のデータとして表示
            renderReceiveList([]);
            // ユーザーフレンドリーなエラーメッセージ
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                alert('サーバーに接続できません。ネットワーク接続を確認してください。');
            } else {
                alert(`受領リスト読み込みエラー: ${error.message}`);
            }
        }
    }

    // Render Receive List
    function renderReceiveList(deliveries) {
        receiveTbody.innerHTML = '';

        if (deliveries.length === 0) {
            noReceive.style.display = 'block';
            return;
        }

        noReceive.style.display = 'none';

        deliveries.forEach(delivery => {
            const tr = document.createElement('tr');
            const itemsText = Array.isArray(delivery.items)
                ? delivery.items.map(i => `${i.name} × ${i.quantity}`).join('<br>')
                : (delivery.items || '-');

            const tdDate = document.createElement('td');
            tdDate.setAttribute('data-label', '日付');
            tdDate.textContent = delivery.date;

            const tdFrom = document.createElement('td');
            tdFrom.setAttribute('data-label', '出庫元');
            tdFrom.textContent = delivery.from_branch;

            const tdTo = document.createElement('td');
            tdTo.setAttribute('data-label', '入庫先');
            tdTo.textContent = delivery.to_branch;

            const tdItems = document.createElement('td');
            tdItems.setAttribute('data-label', '品目');
            tdItems.innerHTML = itemsText;

            const tdCheck = document.createElement('td');
            tdCheck.setAttribute('data-label', '受領');
            tdCheck.innerHTML = `
                <label class="custom-checkbox-container">
                    <input type="checkbox" onchange="toggleReceive(${delivery.id}, this)">
                    <span class="checkmark"></span>
                    受領チェック
                </label>
            `;

            const tdAction = document.createElement('td');
            tdAction.setAttribute('data-label', '操作');
            tdAction.innerHTML = `<button class="btn btn-small btn-secondary-action" onclick="viewDetail(${delivery.id})">詳細</button>`;

            tr.appendChild(tdDate);
            tr.appendChild(tdFrom);
            tr.appendChild(tdTo);
            tr.appendChild(tdItems);
            tr.appendChild(tdCheck);
            tr.appendChild(tdAction);
            receiveTbody.appendChild(tr);
        });
    }

    // Close Modal
    function closeModal() {
        detailModal.classList.remove('active');
    }
});

// Global Functions
// View Detail
window.viewDetail = async function (id) {
    const detailModal = document.getElementById('detail-modal');
    const modalBody = document.getElementById('modal-body');

    try {
        const response = await fetch(`${API_BASE}/deliveries/${id}`);
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const delivery = await response.json();

        modalBody.innerHTML = `
            <div style="margin-bottom: 1rem;">
                <strong>日付:</strong> ${delivery.date}
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>入庫先:</strong> ${delivery.to_branch}
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>ステータス:</strong> ${delivery.status === 'received' ? '受領済み' : '作成済み'}
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>品目:</strong>
                <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                    ${delivery.items.map(item => `<li>${item.name} × ${item.quantity}袋</li>`).join('')}
                </ul>
            </div>
            ${delivery.note ? `<div style="margin-bottom: 1rem;"><strong>備考:</strong><br>${delivery.note}</div>` : ''}
            ${delivery.received_at ? `
                <div style="margin-bottom: 0.5rem;">
                    <strong>受領日時:</strong> ${new Date(delivery.received_at).toLocaleString('ja-JP')}
                </div>
                <div style="margin-bottom: 0.5rem;">
                    <strong>受領者:</strong> ${delivery.received_by || '不明'}
                </div>
            ` : ''}
        `;

        detailModal.classList.add('active');
    } catch (error) {
        console.error('Error loading detail:', error);
        alert(`詳細の読み込みに失敗しました`);
    }
};

// Checkbox Receive Action
// Checkbox Receive Action
window.toggleReceive = async function (id, checkbox) {
    if (!checkbox.checked) return; // Ignore uncheck? Usually once received, it's done.

    // 1. Prompt for Receiver Name directly (Confirmation removed as requested)
    const receiverName = prompt('受領者の氏名を入力してください:');
    if (!receiverName || receiverName.trim() === '') {
        alert('受領者名が入力されていないため、キャンセルしました。');
        checkbox.checked = false;
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/deliveries/${id}/receive`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receivedBy: receiverName })
        });

        if (response.ok) {
            alert('受領を確認しました');
            // Refresh list
            const applyReceiveFilterBtn = document.getElementById('apply-receive-filter-btn');
            if (applyReceiveFilterBtn) applyReceiveFilterBtn.click();
        } else {
            const result = await response.json();
            alert('エラーが発生しました: ' + (result.error || 'Unknown error'));
            checkbox.checked = false;
        }
    } catch (error) {
        console.error('Error receiving:', error);
        alert('通信エラー');
        checkbox.checked = false;
    }
};


// Delete Delivery
window.deleteDelivery = async function (id) {
    if (!confirm('このデータを削除しますか?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/deliveries/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('送付記録を削除しました');
            const applyFilterBtn = document.getElementById('apply-filter-btn');
            if (applyFilterBtn) applyFilterBtn.click();
        } else {
            const result = await response.json();
            alert('エラー: ' + result.error);
        }
    } catch (error) {
        console.error('Error deleting delivery:', error);
        alert(`削除に失敗しました: ${error.message}`);
    }
};
