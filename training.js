
// ==========================================
// Training Management Logic
// ==========================================

// ---------------------------------------------------------
// Compatibility Shim for Curriculum.js (v9 -> v8 bridging)
// This ensures `window.firestoreUtils` exists for other scripts
// like curriculum.js to function correctly.
// ---------------------------------------------------------
// ---------------------------------------------------------
(function() {
    // Safety check: Firebase might not be loaded yet
    if (!window.firebase || !window.firebase.firestore) return;

    if (window.firebase && window.firebase.firestore) {
        const db = window.firebase.firestore();
        if (!window.db) window.db = db;
        
        if (!window.firestoreUtils) {
            console.log("Installing Firestore Utils Shim for compatibility...");
            window.firestoreUtils = {
                collection: (d, path) => db.collection(path),
                doc: (d, col, id) => db.collection(col).doc(id),
                
                // Wrap getDoc to support v9 .exists() method style
                getDoc: async (ref) => {
                    try {
                        const snap = await ref.get();
                        // Return a proxy object that has .exists() method
                        return {
                            exists: () => snap.exists, // v9 style function
                            data: () => snap.data(),
                            id: snap.id,
                            ref: snap.ref,
                            _original: snap
                        };
                    } catch (e) {
                        console.error("Shim getDoc error:", e);
                        throw e;
                    }
                },
                
                // Wrap getDocs to support v9 .exists() on docs
                getDocs: async (query) => {
                    try {
                        const snap = await query.get();
                        const docs = snap.docs.map(d => ({
                            exists: () => d.exists,
                            data: () => d.data(),
                            id: d.id,
                            ref: d.ref,
                            _original: d
                        }));
                        return {
                            docs: docs,
                            empty: snap.empty,
                            size: snap.size,
                            forEach: (cb) => docs.forEach(cb)
                        }; 
                    } catch (e) {
                        console.error("Shim getDocs error:", e);
                        throw e;
                    }
                },
                
                setDoc: (ref, data) => ref.set(data),
                updateDoc: (ref, data) => ref.update(data),
                deleteDoc: (ref) => ref.delete(),
                addDoc: (ref, data) => ref.add(data), 
                query: (ref) => ref, // Simple passthrough as no constraints used
                serverTimestamp: window.firebase.firestore.FieldValue.serverTimestamp,
                arrayUnion: window.firebase.firestore.FieldValue.arrayUnion,
                arrayRemove: window.firebase.firestore.FieldValue.arrayRemove
            };
        }
    }
})();

var trainingList = []; // changed to var to avoid TDZ
var trainingDb = null; // Renamed from firestoreInstance to avoid conflict
var trainingStaffList = ["교장", "행정실장", "김미화", "윤해정", "양혜정", "선민영", "오연주", "빈태선", "이미라", "이대원", "안복연", "서민석", "방봉혁", "이주현", "신은주", "서수연", "김향선", "천순화", "박갑점"];
var currentSort = { column: 'createdAt', direction: 'asc' }; // Priority: Oldest first (1st item at top)
var currentCompleterTrainingId = null;

function initTraining() {
    console.log("Training module initialized");

    // Modal Events
    setupModalEvents();

    // Init Firestore
    initFirestore();

    // Initial Load
    loadTrainings();
}

// Global Exports
window.initTraining = initTraining;
window.openTrainingModal = openTrainingModal;
window.closeTrainingModal = closeTrainingModal;
window.deleteTraining = deleteTraining;
window.openTrainingEdit = openTrainingEdit;
window.updateSegmentStyle = updateSegmentStyle;
window.addCompleter = addCompleter;
window.removeCompleter = removeCompleter;

// ---------------------------------------------------------
// Firestore Initialization
// ---------------------------------------------------------
function initFirestore() {
    if (window.firebase && window.firebase.firestore) {
        trainingDb = window.firebase.firestore();
    } else if (window.db && window.db.collection) {
        trainingDb = window.db;
    } else {
        console.error("Firebase Firestore not found via window.firebase or window.db");
    }
}

// ---------------------------------------------------------
// Helper: Update Segment UI
// ---------------------------------------------------------
function updateSegmentStyle(input) {
    const group = input.closest('.segmented-control');
    const allBoxes = group.querySelectorAll('.segment-box');
    allBoxes.forEach(box => {
        box.classList.remove('active');
    });

    const activeBox = input.nextElementSibling;
    if (activeBox) {
        activeBox.classList.add('active');
    }
}

// ---------------------------------------------------------
// Data Loading & Rendering
// ---------------------------------------------------------
async function loadTrainings() {
    const tbody = document.getElementById('training-list');
    if (!tbody) return;

    if (!trainingDb) {
        initFirestore();
        if (!trainingDb) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:red; padding:30px;">데이터베이스 연결 실패. 페이지를 새로고침하세요.</td></tr>';
            return;
        }
    }

    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:30px;">데이터를 불러오는 중...</td></tr>';

    try {
        let query = trainingDb.collection("trainings").orderBy("createdAt", "desc");
        const snapshot = await query.get();

        trainingList = [];
        snapshot.forEach(doc => {
            trainingList.push({ id: doc.id, ...doc.data() });
        });

        renderTrainingTable();

    } catch (e) {
        console.error("Error loading trainings:", e);
        if (e.code === 'failed-precondition' && e.message.includes('index')) {
            const linkMatch = e.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
            const link = linkMatch ? linkMatch[0] : '#';
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#ef4444; padding:20px;">
                <a href="${link}" target="_blank" style="text-decoration:underline; font-weight:bold;">[클릭] 인덱스 생성이 필요합니다.</a>
            </td></tr>`;
        } else {
            // Fallback: client-side sort
            try {
                const snapshot = await trainingDb.collection("trainings").get();
                trainingList = [];
                snapshot.forEach(doc => { trainingList.push({ id: doc.id, ...doc.data() }); });
                trainingList.sort((a,b) => (b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : 0) - (a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : 0));
                renderTrainingTable();
            } catch (retryErr) {
                tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:red;">로딩 실패: ${e.message}</td></tr>`;
            }
        }
    }
}

function renderTrainingTable() {
    const tbody = document.getElementById('training-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Sort Logic with Safety Check
    // Use window.currentSort if available, or fallback to the global var currentSort, or default
    let sortState = { column: 'createdAt', direction: 'asc' };
    if (typeof currentSort !== 'undefined') sortState = currentSort;
    if (typeof window.currentSort !== 'undefined') sortState = window.currentSort;

    trainingList.sort((a, b) => {
        let valA, valB;
        if (sortState.column === 'date' || sortState.column === 'createdAt') {
             valA = (a.createdAt && a.createdAt.seconds) ? a.createdAt.seconds : 0;
             valB = (b.createdAt && b.createdAt.seconds) ? b.createdAt.seconds : 0;
        } else if (sortState.column === 'deadline') {
             valA = a.deadline || '9999-99-99';
             valB = b.deadline || '9999-99-99';
        } else if (sortState.column === 'manager') {
             valA = a.manager || '';
             valB = b.manager || '';
        } else if (sortState.column === 'title') {
             valA = a.title || '';
             valB = b.title || '';
        } else if (sortState.column === 'category') {
             valA = a.category || '';
             valB = b.category || '';
        } else if (sortState.column === 'target') {
             // For target array, join to string
             const tA = Array.isArray(a.target) ? a.target.join('') : (a.target || '');
             const tB = Array.isArray(b.target) ? b.target.join('') : (b.target || '');
             valA = tA;
             valB = tB;
        } else {
             valA = a[sortState.column] || '';
             valB = b[sortState.column] || '';
        }

        if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
        return 0;
    });

    if (trainingList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:40px; color: #94a3b8;">등록된 연수 정보가 없습니다.</td></tr>';
        return;
    }
    
    trainingList.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #cbd5e1'; 
        
        // Number: 1, 2, 3...
        const num = index + 1; 

        const isEssential = item.category === '필수';
        // Convert old data '선택' to '권장' for display
        let displayCat = item.category || '권장';
        if (displayCat === '선택') displayCat = '권장';
        
        const categoryBadge = `<span class="badge ${isEssential ? 'badge-essential' : 'badge-optional'}">${displayCat}</span>`;

        const title = `<div style="font-weight:600; color:#1e293b;">${item.title || '-'}</div>`;
        
        let targetDisplay = '-';
        if (Array.isArray(item.target)) {
            const fullText = item.target.join(', ');
            targetDisplay = `<div style="max-width:120px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${fullText}">${fullText}</div>`;
        } else if (item.target) {
            targetDisplay = item.target;
        }
        
        // ShortTerm Logic Removed

        const deadline = item.deadline || '-';
        const manager = item.manager || '-';
        
        let linkDisplay = '-';
        if (item.link) {
            const label = item.siteName || '바로가기';
            let href = item.link;
            if (!href.startsWith('http')) href = 'https://' + href;
            linkDisplay = `<a href="${href}" target="_blank" style="color: #3b82f6; text-decoration: none; font-weight:500;">
                <i class="fas fa-link" style="margin-right:4px;"></i>${label}
            </a>`;
        } else {
             linkDisplay = item.siteName || '-';
        }

        // Completer Logic (Tag List + Modal Button)
        const completers = item.completers || [];
        let tagHtml = '';
        completers.forEach(c => {
             const name = (typeof c === 'object') ? c.text : c; 
             if (!name || name === 'undefined') return;

             const removeId = (typeof c === 'object' && c.id) ? c.id : ((typeof c === 'object' && c.text) ? c.text : name);
             tagHtml += `<span class="completer-tag-modern">${name} <i class="fas fa-times remove-btn" onclick="window.removeCompleterFromTraining('${item.id}', '${removeId}')"></i></span>`;
        });

        // Use ONLY button for adding
        const completerSection = `
            <div class="completer-list-inline">
                ${tagHtml}
                <button class="completer-add-btn-sm" onclick="window.openCompleterModal('${item.id}')" title="이수자 추가/관리">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        `;
        
        // Actions
        const actions = `
            <div style="display:flex; justify-content:center; gap:8px;">
                <button class="icon-btn" onclick="window.openTrainingEdit('${item.id}')" title="수정" style="color:#64748b; background:none; border:none; cursor:pointer;"><i class="fas fa-pen"></i></button>
                <button class="icon-btn delete-btn" onclick="window.deleteTraining('${item.id}')" title="삭제" style="color:#ef4444; background:none; border:none; cursor:pointer;"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;

        const note = item.note || '';
        const noteInput = `<input type="text" value="${note}" class="note-input-modern" placeholder="내용 입력" onchange="window.updateTrainingNote('${item.id}', this.value)" onblur="window.updateTrainingNote('${item.id}', this.value)">`;

        tr.innerHTML = `
            <td class="col-num">${num}</td>
            <td class="col-category">${categoryBadge}</td>
            <td class="col-title" title="${item.title || ''}">${title}</td>
            <td class="col-target" title="${item.target || ''}">${targetDisplay}</td>
            <td class="col-deadline">${deadline}</td>
            <td class="col-manager">${manager}</td>
            <td class="col-link">${linkDisplay}</td>
            <td class="col-completers">${completerSection}</td>
            <td class="col-note">${noteInput}</td>
            <td class="col-actions">${actions}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Completer Actions
// ---------------------------------------------------------
// ---------------------------------------------------------
// Note Update Action
// ---------------------------------------------------------
window.updateTrainingNote = async (trainingId, noteValue) => {
    if (!trainingDb) initFirestore(); // Safety Init
    if (!trainingDb) return;
    try {
        await trainingDb.collection("trainings").doc(trainingId).update({
            note: noteValue
        });
        // No strict need to re-render, but updating local list is good practice
        const item = trainingList.find(i => i.id === trainingId);
        if(item) item.note = noteValue;
        
        // Optional: Show saved feedback (e.g. toast) or just silent update
    } catch (e) {
        console.error("Error updating note:", e);
        alert("비고 저장 중 오류가 발생했습니다.");
    }
};

// ---------------------------------------------------------
// Completer Actions
// ---------------------------------------------------------
async function addCompleter(trainingId) {
    if (!trainingDb) return;
    
    const input = document.getElementById(`input-completer-${trainingId}`);
    if (!input || !input.value.trim()) return;

    const name = input.value.trim();
    const trainRef = trainingDb.collection("trainings").doc(trainingId);
    
    // Create unique-ish ID for removal if needed, or just store object
    const newEntry = {
        id: Date.now().toString(), // simple unique id
        text: name,
        addedAt: new Date().toISOString()
    };
    
    try {
        const arrayUnion = window.firebase.firestore.FieldValue.arrayUnion;
        await trainRef.update({
             completers: arrayUnion(newEntry)
        });
        // Optimistic UI update or reload
        loadTrainings();
    } catch (e) {
        console.error("Add completer error:", e);
        alert("추가 중 오류 발생");
    }
}

// Renamed to avoid confusion with staff remove
window.removeCompleterFromTraining = async function(trainingId, completerId) {
    if (!trainingDb) initFirestore(); // Safety Init
    if (!confirm("삭제하시겠습니까?")) return;
    if (!trainingDb) return;

    const trainRef = trainingDb.collection("trainings").doc(trainingId);
    
    try {
        const docSnap = await trainRef.get();
        if (docSnap.exists) { 
            const data = docSnap.data();
            const currentList = data.completers || [];
            
            // Remove logic updated to handle objects without ID
            const newList = currentList.filter(c => {
               if (typeof c === 'object') {
                   // If obj has ID, match ID.
                   if (c.id && c.id === completerId) return false;
                   // If completerId passed matches text directly
                   if (c.text && c.text === completerId) return false;
                   // If text is undefined, remove it (cleanup)
                   if (!c.text) return false;
                   return true;
               }
               // String match
               return c !== completerId;
            });
            
            await trainRef.update({ completers: newList });
            loadTrainings();
        }
    } catch (e) {
        console.error("Remove completer error:", e);
        alert("삭제 중 오류 발생");
    }
}


// ---------------------------------------------------------
// Modal & Form Handling
// ---------------------------------------------------------

function setupModalEvents() {
    // Checkbox 'All' logic REMOVED (User request: simple checkbox)
    // const allCheck = document.getElementById('target-all');
    // ... removed ...

    // Direct Input logic
    const directCheck = document.getElementById('target-direct-check');
    const directInput = document.getElementById('target-direct-input');
    
    if (directCheck) {
        directCheck.addEventListener('change', (e) => {
            directInput.disabled = !e.target.checked;
            if (e.target.checked) directInput.focus();
            else directInput.value = '';
        });
    }

    // Form Submit
    const form = document.getElementById('trainingForm');
    if (form) {
        form.onsubmit = handleTrainingSubmit;
    }
}

function openTrainingModal() {
    const modal = document.getElementById('trainingModal');
    if (!modal) return;
    
    document.getElementById('trainingForm').reset();
    document.getElementById('training-id').value = '';
    
    const defaultCat = document.querySelector('input[name="trainingCategory"][value="필수"]');
    if (defaultCat) {
        defaultCat.checked = true;
        updateSegmentStyle(defaultCat);
    }
    
    document.getElementById('target-direct-input').disabled = true;
    modal.classList.add('active');
}

function closeTrainingModal() {
    const modal = document.getElementById('trainingModal');
    if (modal) modal.classList.remove('active');
}

function openTrainingEdit(id) {
    const item = trainingList.find(i => i.id === id);
    if (!item) return;

    openTrainingModal();
    
    document.getElementById('training-id').value = item.id;
    document.getElementById('training-title').value = item.title || '';
    
    const catRadios = document.getElementsByName('trainingCategory');
    catRadios.forEach(r => {
        if (r.value === item.category) {
            r.checked = true;
            updateSegmentStyle(r);
        }
    });

    // ShortTerm populate logic REMOVED

    document.getElementById('training-deadline').value = item.deadline || '';
    document.getElementById('training-manager').value = item.manager || '';

    document.getElementById('training-site-name').value = item.siteName || '';
    document.getElementById('training-link').value = item.link || '';

    // ShortTerm logic REMOVED

    document.querySelectorAll('input[name="target"]').forEach(cb => cb.checked = false);
    document.getElementById('target-direct-check').checked = false;
    document.getElementById('target-direct-input').disabled = true;
    document.getElementById('target-direct-input').value = '';
    
    const targets = Array.isArray(item.target) ? item.target : [];
    
    targets.forEach(t => {
        const cb = document.querySelector(`input[name="target"][value="${t}"]`);
        if (cb) {
            cb.checked = true;
        } else {
            // Direct input check logic (simple heuristic)
             if (t && !['전교직원','교장','교원','지방공무원','교육공무직','담당자'].includes(t)) {
                document.getElementById('target-direct-check').checked = true;
                const directInput = document.getElementById('target-direct-input');
                directInput.disabled = false;
                directInput.value = t;
            }
        }
    });
}

async function handleTrainingSubmit(e) {
    e.preventDefault();
    
    if (!trainingDb) {
        alert("데이터베이스 연결이 되지 않았습니다.");
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = "저장 중...";
    
    const id = document.getElementById('training-id').value;
    
    const category = document.querySelector('input[name="trainingCategory"]:checked')?.value || '권장';
    const title = document.getElementById('training-title').value;
    
    // Validation
    if (!title) {
        alert("연수명을 입력해주세요.");
        return;
    }
    
    const targetList = [];
    document.querySelectorAll('input[name="target"]:checked').forEach(cb => {
        targetList.push(cb.value);
    });
    
    if (document.getElementById('target-direct-check').checked) {
        document.getElementById('target-direct-input').disabled = false; // ensure it is enabled to read value
        const directVal = document.getElementById('target-direct-input').value.trim();
        if (directVal) targetList.push(directVal);
    }
    
    const uniqueTargets = [...new Set(targetList)];
    
    if (uniqueTargets.length === 0) {
        alert("연수대상을 하나 이상 선택해주세요.");
        return;
    }

    // Short-term logic REMOVED
    const deadline = document.getElementById('training-deadline').value;
    const manager = document.getElementById('training-manager').value;
    const siteName = document.getElementById('training-site-name').value;
    const siteLink = document.getElementById('training-link').value;

    const serverTimestamp = window.firebase.firestore.FieldValue.serverTimestamp;

    const data = {
        category,
        title,
        target: uniqueTargets, 
        // shortTerm: removed
        deadline,
        manager,
        siteName,
        link: siteLink,
        updatedAt: serverTimestamp()
    };

    try {
        if (id) {
            await trainingDb.collection("trainings").doc(id).update(data);
            if(window.logUserAction) window.logUserAction('training', '수정', `연수 수정: ${title}`);
        } else {
            data.createdAt = serverTimestamp();
            data.completers = [];
            await trainingDb.collection("trainings").add(data);
            if(window.logUserAction) window.logUserAction('training', '생성', `새 연수 등록: ${title}`);
        }
        closeTrainingModal();
        loadTrainings();
    } catch (err) {
        console.error("Save error:", err);
        alert("저장 중 오류가 발생했습니다: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
    }
}

async function deleteTraining(id) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    if (!trainingDb) return;

    try {
        await trainingDb.collection("trainings").doc(id).delete();
        loadTrainings();
    } catch (err) {
        console.error("Delete error:", err);
        alert("삭제 중 오류가 발생했습니다.");
    }
}

// ---------------------------------------------------------
// Sorting Logic
// ---------------------------------------------------------
window.sortTrainings = (col) => {
    if (currentSort.column === col) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = col;
        currentSort.direction = 'asc';
    }
    renderTrainingTable();
};

// ---------------------------------------------------------
// Staff & Completer Modal Logic
// ---------------------------------------------------------
// Load Staff List (from DB 'settings/staff' or default)
async function loadStaffConfig() {
    if (!trainingDb) initFirestore(); // Safety Init
    if (!trainingDb) return;
    try {
        const docRef = trainingDb.collection("settings").doc("staff");
        // Using shim getDoc
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            if (data.list && Array.isArray(data.list)) {
                trainingStaffList = data.list;
            }
        } else {
            // Setup initial default if not exists
            await docRef.set({ list: trainingStaffList });
        }
    } catch (e) {
        console.warn("Staff config load error:", e);
    }
}

// Ensure staff list is loaded on init
(function(){
    // We can't await here easily, but we can try to load it when DB is ready.
    // Ideally call loadStaffConfig() inside initTraining() or after DB init.
})();

window.openCompleterModal = (trainingId) => {
    currentCompleterTrainingId = trainingId;
    loadStaffConfig().then(() => { // Ensure latest list
        const modal = document.getElementById('completerModal');
        const title = document.querySelector('#completerModal h2');
        
        // Find training title for UI
        const training = trainingList.find(t => t.id === trainingId);
        if(training) title.innerText = `이수자 선택: ${training.title}`;
        else title.innerText = "이수자 선택";

        // Set current completers in a Set for fast lookup
        const currentCompleters = new Set();
        if (training && training.completers) {
            training.completers.forEach(c => {
                const name = (typeof c === 'object') ? c.text : c;
                currentCompleters.add(name);
            });
        }

        renderCompleterCheckboxes(currentCompleters);
        modal.classList.add('active');
    });
};

window.closeCompleterModal = () => {
    document.getElementById('completerModal').classList.remove('active');
    currentCompleterTrainingId = null;
};

function renderCompleterCheckboxes(selectedSet = new Set(), filterText = '') {
    const listContainer = document.getElementById('completer-list-container');
    listContainer.innerHTML = '';
    
    const PRIORITY = ["교장", "행정실장"];
    
    // Sort logic: Priority first, then DESC (ㅎ->ㄱ) as requested
    const finalSorted = [...trainingStaffList].sort((a, b) => {
        const idxA = PRIORITY.indexOf(a);
        const idxB = PRIORITY.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return b.localeCompare(a); // DESC (ㅎ -> ㄱ)
    });

    let count = 0;
    finalSorted.forEach(name => {
        if (filterText && !name.includes(filterText)) return;
        
        const div = document.createElement('div');
        div.style.padding = '8px'; // improved padding
        div.style.borderBottom = '1px solid #f1f5f9';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.className = 'completer-item-row'; 
        
        const isChecked = selectedSet.has(name);
        if (isChecked) count++;

        div.innerHTML = `
            <label style="display:flex; align-items:center; width:100%; cursor:pointer;">
                <input type="checkbox" value="${name}" class="completer-checkbox" ${isChecked ? 'checked' : ''} onchange="window.updateCompleterCount()" style="transform: scale(1.2); accent-color: #3b82f6;">
                <span style="margin-left:10px; font-weight:500; color:#334155;">${name}</span>
            </label>
        `;
        listContainer.appendChild(div);
    });
    document.getElementById('completer-selected-count').innerText = count;
}

window.filterCompleterList = () => {
    const text = document.getElementById('completer-search').value.trim();
    // Re-rendering loses check state if not careful. 
    // Just hiding/showing is better.
    const container = document.getElementById('completer-list-container');
    const items = container.querySelectorAll('.completer-item-row'); // need class
    items.forEach(div => {
        const name = div.querySelector('span').innerText;
        if (name.includes(text)) div.style.display = 'flex';
        else div.style.display = 'none';
    });
};

window.updateCompleterCount = () => {
    const checked = document.querySelectorAll('.completer-checkbox:checked').length;
    document.getElementById('completer-selected-count').innerText = checked;
};

window.saveCompleters = async () => {
    if (!trainingDb) initFirestore(); // Safety Init
    if (!currentCompleterTrainingId || !trainingDb) return;
    
    // Collect checked names
    const checkboxes = document.querySelectorAll('.completer-checkbox:checked');
    const newCompleters = Array.from(checkboxes).map(cb => cb.value); // Simple strings
    
    try {
        await trainingDb.collection("trainings").doc(currentCompleterTrainingId).update({
            completers: newCompleters
        });
        window.closeCompleterModal();
        loadTrainings(); // Refresh table
    } catch (e) {
        console.error("Save completers error:", e);
        alert("저장 실패");
    }
};

// Staff Settings Logic
window.openStaffSettingsModal = () => {
    // Only Admin Check? User said "관리자 권한을 가진 계정이...". 
    // We can check role here or just allow UI access and let Firestore rules block (if set).
    // For now, allow UI.
    const modal = document.getElementById('staffSettingsModal');
    loadStaffConfig().then(() => {
        renderStaffManagementList();
        modal.classList.add('active');
    });
};

function renderStaffManagementList() {
    const list = document.getElementById('staff-management-list');
    list.innerHTML = '';
    
    // Sort same way as display? Or just list order? 
    // Just list order for management is usually better, or ASC.
    const sorted = [...trainingStaffList].sort(); 

    sorted.forEach(name => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center'; // Vertical align
        li.style.padding = '10px';
        li.style.borderBottom = '1px solid #f1f5f9';
        
        li.innerHTML = `
            <span style="font-weight:500;">${name}</span>
            <button class="btn-text" style="color:#ef4444;" onclick="window.removeStaffMember('${name}')"><i class="fas fa-times"></i></button>
        `;
        list.appendChild(li);
    });
}

window.addStaffMember = async () => {
    const input = document.getElementById('new-staff-name');
    const name = input.value.trim();
    if (!name) return;
    
    if (!trainingStaffList.includes(name)) {
        trainingStaffList.push(name);
        await saveStaffConfig();
        renderStaffManagementList();
        input.value = '';
    } else {
        alert("이미 존재하는 이름입니다.");
    }
};

window.removeStaffMember = async (name) => {
    if (!confirm(`${name} 님을 목록에서 삭제하시겠습니까?`)) return;
    trainingStaffList = trainingStaffList.filter(n => n !== name);
    await saveStaffConfig();
    renderStaffManagementList();
};

async function saveStaffConfig() {
    if (!trainingDb) return;
    try {
        await trainingDb.collection("settings").doc("staff").set({
            list: trainingStaffList
        });
    } catch (e) {
        console.error("Save staff config error:", e);
        alert("설정 저장 실패 (권한이 없을 수 있습니다)");
    }
}
