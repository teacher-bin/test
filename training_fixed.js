
// Training Fix Script to Override Broken Functions and Ensure DB Connectivity

// Helper to get Firestore instance safely
function getTrainingDb() {
    if (window.trainingDb) return window.trainingDb;
    if (window.firebase && window.firebase.firestore) {
        window.trainingDb = window.firebase.firestore();
        return window.trainingDb;
    }
    if (window.db && window.db.collection) {
        window.trainingDb = window.db;
        return window.trainingDb;
    }
    console.error("Firestore not found");
    return null;
}

// ---------------------------------------------------------
// Completer Actions (Overridden)
// ---------------------------------------------------------

// Renamed to avoid confusion with staff remove
window.removeCompleterFromTraining = async function(trainingId, completerId) {
    const db = getTrainingDb();
    
    if (!confirm("삭제하시겠습니까?")) return;
    if (!db) {
        alert("데이터베이스 연결 실패");
        return;
    }

    const trainRef = db.collection("trainings").doc(trainingId);
    
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
            
            const trainItem = (window.trainingList || []).find(i => i.id === trainingId);
            const trainTitle = trainItem ? trainItem.title : '알 수 없음';
            
            await trainRef.update({ completers: newList });
            if(window.logUserAction) window.logUserAction('training', '수정', `[${trainTitle}] 이수자 명단 수정: ${completerId} 삭제`);
            if (typeof window.loadTrainings === 'function') window.loadTrainings();
        }
    } catch (e) {
        console.error("Remove completer error:", e);
        alert("삭제 중 오류 발생: " + e.message);
    }
};

window.saveCompleters = async () => {
    const db = getTrainingDb();
    if (!window.currentCompleterTrainingId || !db) return;
    
    // Collect checked names
    const checkboxes = document.querySelectorAll('.completer-checkbox:checked');
    const newCompleters = Array.from(checkboxes).map(cb => cb.value); // Simple strings
    
    try {
        const trainItem = (window.trainingList || []).find(i => i.id === window.currentCompleterTrainingId);
        const trainTitle = trainItem ? trainItem.title : '알 수 없음';
        
        await db.collection("trainings").doc(window.currentCompleterTrainingId).update({
            completers: newCompleters
        });
        if(window.logUserAction) window.logUserAction('training', '수정', `[${trainTitle}] 이수자 명단 일괄 수정`);
        if (typeof window.closeCompleterModal === 'function') window.closeCompleterModal();
        if (typeof window.loadTrainings === 'function') window.loadTrainings();
    } catch (e) {
        console.error("Save completers error:", e);
        alert("저장 실패: " + e.message);
    }
};

window.updateTrainingNote = async (trainingId, noteValue) => {
    const db = getTrainingDb();
    if (!db) return;
    try {
        const trainItem = (window.trainingList || []).find(i => i.id === trainingId);
        const trainTitle = trainItem ? trainItem.title : '알 수 없음';
        
        await db.collection("trainings").doc(trainingId).update({
            note: noteValue
        });
        if(window.logUserAction) window.logUserAction('training', '수정', `[${trainTitle}] 비고 업데이트: ${noteValue}`);
        // Silent update
    } catch (e) {
        console.error("Error updating note:", e);
    }
};

window.updateTrainingLink = async (trainingId, siteName, link) => {
    const db = getTrainingDb();
    if (!db) return;
    try {
        const updates = {};
        if (siteName !== null) updates.siteName = siteName;
        if (link !== null) updates.link = link;
        const trainItem = (window.trainingList || []).find(i => i.id === trainingId);
        const trainTitle = trainItem ? trainItem.title : '알 수 없음';
        
        await db.collection("trainings").doc(trainingId).update(updates);
        if(window.logUserAction) window.logUserAction('training', '수정', `[${trainTitle}] 연수 정보(링크/사이트명) 수정`);
    } catch (e) {
        console.error("Error updating link info:", e);
    }
};

// ---------------------------------------------------------
// Sorting Logic (Overridden)
// ---------------------------------------------------------
window.sortTrainings = (col) => {
    // Ensure currentSort exists
    if (!window.currentSort) {
        window.currentSort = { column: 'createdAt', direction: 'asc' };
    }

    if (window.currentSort.column === col) {
        window.currentSort.direction = window.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        window.currentSort.column = col;
        window.currentSort.direction = 'asc';
    }
    // Initial Render Call
    if (typeof window.renderTrainingTable === 'function') window.renderTrainingTable();
};

// ---------------------------------------------------------
// Core Rendering & Logic (Overridden)
// ---------------------------------------------------------

window.deleteTraining = async (id) => {
    const db = getTrainingDb();
    if (!confirm("정말 이 연수를 삭제하시겠습니까?")) return;
    if (!db) return;
    const item = (window.trainingList || []).find(i => i.id === id);
    const title = item ? item.title : '알 수 없음';
    
    try {
        await db.collection("trainings").doc(id).delete();
        if(window.logUserAction) window.logUserAction('training', '삭제', `연수 삭제: ${title}`);
        if (typeof window.loadTrainings === 'function') window.loadTrainings();
    } catch(e) {
        console.error("Delete error:", e);
        alert("삭제 실패");
    }
};

// Toggle All
window.toggleAllCompleters = (selectAll) => {
    const container = document.getElementById('completer-list-container');
    if(!container) return;
    
    // Only target visible items if filtering? Or all? Usually visible.
    // Let's do all for now, or respect filter if needed. User just said "Select All".
    const btns = container.querySelectorAll('.completer-chip-btn');
    btns.forEach(btn => {
        if(btn.style.display === 'none') return; // Skip hidden by filter
        
        const checkbox = btn.querySelector('input[type="checkbox"]');
        if(checkbox) {
            checkbox.checked = selectAll;
            window.updateCompleterStyle(btn, selectAll);
        }
    });
    window.updateCompleterCount();
};

// Toggle Completer List Visibility
window.toggleCompleterList = (trainingId) => {
    const list = document.getElementById(`completer-list-${trainingId}`);
    const btn = document.getElementById(`completer-btn-${trainingId}`);
    
    if (list) {
        list.classList.toggle('active');
        if (btn) {
           btn.classList.toggle('expanded');
        }
    }
};

window.renderTrainingTable = () => {
    const list = window.trainingList || [];
    const tbody = document.getElementById('training-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    const sortState = window.currentSort || { column: 'orderIndex', direction: 'asc' };
    list.sort((a, b) => {
        let valA, valB;
        if (sortState.column === 'orderIndex') {
             valA = (a.orderIndex !== undefined) ? a.orderIndex : 999;
             valB = (b.orderIndex !== undefined) ? b.orderIndex : 999;
        } else if (sortState.column === 'date' || sortState.column === 'createdAt') {
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

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding: 20px;">등록된 연수가 없습니다.</td></tr>';
        return;
    }

    list.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.dataset.id = item.id; // Correct ID for Sortable
        tr.style.borderBottom = '1px solid #cbd5e1'; 
        
        const num = index + 1; 

        const isEssential = item.category === '필수';
        let displayCat = item.category || '권장';
        if (displayCat === '선택') displayCat = '권장';
        
        const categoryBadge = `<span class="badge ${isEssential ? 'badge-essential' : 'badge-optional'}">${displayCat}</span>`;

        const title = `<div style="font-weight:600; color:#1e293b;">${item.title || '-'}</div>`;
        
        let targetDisplay = '';
        if (Array.isArray(item.target)) {
            item.target.forEach(t => { 
                targetDisplay += `<span class="target-badge">${t}</span>`;
            });
        } else if (item.target) {
            targetDisplay = `<span class="target-badge">${item.target}</span>`;
        }

        const deadline = item.deadline || '-';
        const manager = item.manager || '-';

        // Completers: Status Button Logic with Toggle
        const completers = Array.isArray(item.completers) ? item.completers : [];
        const validCompleters = completers.filter(c => {
             const name = (typeof c === 'object') ? c.text : c;
             return name && name !== 'undefined';
        });
        const count = validCompleters.length;
        
        let btnClass = 'btn-completer-status';
        let btnText = `<i class="fas fa-check-circle"></i> 이수 완료: ${count}명 <i class="fas fa-chevron-down" style="margin-left:auto;"></i>`;
        let btnTitle = '명단 펼치기/접기';
        let onClickAction = `window.toggleCompleterList('${item.id}')`;

        if (count === 0) {
            btnClass += ' empty';
            btnText = '이수자 선택 <i class="fas fa-plus" style="margin-left:auto;"></i>';
            btnTitle = '이수자 추가';
            onClickAction = `window.openCompleterModal('${item.id}')`; // Empty -> Open Modal directly
        }

        // Toggle Content (The List)
        let toggleContent = '';
        if (count > 0) {
             let tags = '';
             validCompleters.forEach(c => {
                 const name = (typeof c === 'object') ? c.text : c; 
                 const removeId = (typeof c === 'object' && c.id) ? c.id : ((typeof c === 'object' && c.text) ? c.text : name);
                 tags += `<span class="completer-tag-modern">${name} <i class="fas fa-times remove-btn" onclick="window.removeCompleterFromTraining('${item.id}', '${removeId}')"></i></span>`;
             });
             // Add button inside the list too
             tags += `<button class="btn-add-completer" onclick="window.openCompleterModal('${item.id}')" title="이수자 추가"><i class="fas fa-plus"></i></button>`;
             
             toggleContent = `
                <div id="completer-list-${item.id}" class="completer-toggle-content">
                    <div class="completer-tags-wrapper">
                        ${tags}
                    </div>
                </div>
             `;
        }

        const tagHtml = `
            <div style="position:relative;">
                <button id="completer-btn-${item.id}" class="${btnClass}" onclick="${onClickAction}" title="${btnTitle}" style="width:100%; justify-content:space-between;">
                    ${btnText}
                </button>
                ${toggleContent}
            </div>
        `;


        const siteName = item.siteName || '';
        const link = item.link || '';
        const linkInfo = siteName || link ? `
            <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:center;">
                ${link ? `<a href="${link.startsWith('http') ? link : 'https://' + link}" target="_blank" style="font-weight:600; color:#3b82f6; text-decoration:underline; font-size:0.85rem;">
                    ${siteName || '링크 이동'} <i class="fas fa-external-link-alt" style="font-size:0.75rem;"></i>
                </a>` : `<span style="color:#94a3b8; font-size:0.85rem;">${siteName || '-'}</span>`}
            </div>
        ` : '<div style="text-align:center; color:#cbd5e1;">-</div>';

        const note = item.note || '';
        const noteInput = `<textarea class="note-input-modern" placeholder="내용 입력" rows="1"
            style="width:95%; height:auto; min-height:32px; resize:none; padding:6px; font-family:inherit; font-size:0.9rem; line-height:1.4; border:1px solid #e2e8f0; border-radius:6px; white-space: pre-wrap; overflow-wrap: break-word; overflow:hidden;"
            oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px';"
            onfocus="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px';"
            onblur="window.updateTrainingNote('${item.id}', this.value)">${note}</textarea>`;
        
        const actionBtns = `
            <div class="training-action-btns">
                <button class="btn-edit" onclick="window.openTrainingEdit('${item.id}')" title="수정"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="window.deleteTraining('${item.id}')" title="삭제"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;

        tr.innerHTML = `
            <td class="col-drag" style="cursor:grab; color:#cbd5e1; text-align:center;"><i class="fas fa-grip-vertical"></i></td>
            <td class="col-num">${num}</td>
            <td class="col-category">${categoryBadge}</td>
            <td class="col-title" style="text-align:left;">${title}</td>
            <td class="col-target"><div style="display:flex; flex-wrap:wrap; gap:4px; justify-content:center;">${targetDisplay}</div></td>
            <td class="col-deadline">${deadline}</td>
            <td class="col-manager">${manager}</td>
            <td class="col-completers" style="text-align:left;">${tagHtml}</td>
            <td class="col-link-info">${linkInfo}</td>
            <td class="col-note" style="min-width:120px;">${noteInput}</td>
            <td class="col-manage">${actionBtns}</td>
        `;

        tbody.appendChild(tr);
    });

    // Auto-resize notes after rendering
    setTimeout(() => {
        const textareas = tbody.querySelectorAll('.note-input-modern');
        textareas.forEach(ta => {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        });

        // Initialize Sortable for training reordering
        if (window.Sortable) {
            Sortable.create(tbody, {
                animation: 150,
                handle: '.col-drag', // Use the dots icon as handle
                ghostClass: 'sortable-ghost',
                onEnd: async function() {
                    const rows = Array.from(tbody.querySelectorAll('tr'));
                    const db = getTrainingDb();
                    if (!db) return;

                    // Batch update orders in Firestore
                    const batch = db.batch();
                    rows.forEach((row, idx) => {
                        const id = row.dataset.id;
                        if (id) {
                            const ref = db.collection('trainings').doc(id);
                            batch.update(ref, { orderIndex: idx });
                            
                            // Immediately update the visual number in the cell
                            const numCell = row.querySelector('.col-num');
                            if (numCell) numCell.textContent = idx + 1;
                        }
                    });

                    try {
                        await batch.commit();
                        if(window.logUserAction) window.logUserAction('training', '이동', '연수 목록 순서 변경');
                        console.log("Training order saved.");
                        // Optional: reload internal list without full re-render if needed
                        // window.loadTrainings(); 
                    } catch (e) {
                        console.error("Order save error:", e);
                    }
                }
            });
        }
    }, 0);
};

// ---------------------------------------------------------
// Missing Modal & Staff Logic (Ported from training.js)
// ---------------------------------------------------------

// Global State for Fixed Module
window.trainingStaffList = ["교장", "행정실장", "김미화", "윤해정", "양혜정", "선민영", "오연주", "빈태선", "이미라", "이대원", "안복연", "서민석", "방봉혁", "이주현", "신은주", "서수연", "김향선", "천순화", "박갑점"];

window.loadStaffConfig = async function() {
    const db = getTrainingDb();
    if (!db) return;
    try {
        const docRef = db.collection("settings").doc("staff");
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            if (data.list && Array.isArray(data.list)) {
                window.trainingStaffList = data.list;
            }
        } else {
            // Setup initial default
            await docRef.set({ list: window.trainingStaffList });
        }
    } catch (e) {
        console.warn("Staff config load error:", e);
    }
};

window.openCompleterModal = (trainingId) => {
    window.currentCompleterTrainingId = trainingId;
    window.loadStaffConfig().then(() => {
        const modal = document.getElementById('completerModal');
        const title = document.querySelector('#completerModal h2');
        
        // Find training title
        // Ensure trainingList exists. If not, try to read from DOM or wait?
        // Usually trainingList is global. If training.js failed, trainingList might be empty.
        // But renderTrainingTable worked (as user said sorting works), so trainingList exists.
        const list = window.trainingList || [];
        const training = list.find(t => t.id === trainingId);
        
        if(title) {
            title.innerText = "이수자 선택";
        }

        // Set current completers
        const currentCompleters = new Set();
        if (training && training.completers) {
            training.completers.forEach(c => {
                const name = (typeof c === 'object') ? c.text : c;
                currentCompleters.add(name);
            });
        }

        window.renderCompleterCheckboxes(currentCompleters);
        if(modal) modal.classList.add('active');
    });
};

window.closeCompleterModal = () => {
    const modal = document.getElementById('completerModal');
    if(modal) modal.classList.remove('active');
    window.currentCompleterTrainingId = null;
};

// Toggle logic helper
window.toggleCompleterSelection = (name, el) => {
    const checkbox = el.querySelector('input[type="checkbox"]');
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        window.updateCompleterStyle(el, checkbox.checked);
        window.updateCompleterCount();
    }
};

window.updateCompleterStyle = (el, isChecked) => {
    if (isChecked) {
        el.classList.add('is-checked');
    } else {
        el.classList.remove('is-checked');
    }
};

window.renderCompleterCheckboxes = (selectedSet = new Set(), filterText = '') => {
    const listContainer = document.getElementById('completer-list-container');
    if(!listContainer) return;
    listContainer.innerHTML = '';
    
    // Style container for flex wrap
    listContainer.style.display = 'flex';
    listContainer.style.flexWrap = 'wrap';
    listContainer.style.gap = '8px';
    listContainer.style.maxHeight = '300px';
    listContainer.style.overflowY = 'auto'; // Keep scroll just in case
    listContainer.style.border = 'none'; // Clean look
    listContainer.style.padding = '10px 0';

    const PRIORITY = ["교장", "행정실장"];
    
    // Sort logic (Priority first, then ASC ㄱ->ㅎ)
    const finalSorted = [...window.trainingStaffList].sort((a, b) => {
        const idxA = PRIORITY.indexOf(a);
        const idxB = PRIORITY.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b); 
    });

    let count = 0;
    finalSorted.forEach(name => {
        if (filterText && !name.includes(filterText)) return;
        
        const isChecked = selectedSet.has(name);
        if (isChecked) count++;

        // Chip Style Button
        const btn = document.createElement('div');
        btn.className = `completer-chip-btn ${isChecked ? 'is-checked' : ''}`;
        
        // Initial Style removed - handled by CSS classes

        // Click Handler (Toggle)
        btn.onclick = (e) => {
            // Prevent double firing if clicking inner checkbox (though hidden)
             if(e.target.tagName === 'INPUT') return;
             window.toggleCompleterSelection(name, btn);
        };

        btn.innerHTML = `
            <input type="checkbox" value="${name}" class="completer-checkbox" ${isChecked ? 'checked' : ''} style="display:none;">
            <span>${name}</span>
        `;
        listContainer.appendChild(btn);
    });
    
    const countSpan = document.getElementById('completer-selected-count');
    if(countSpan) countSpan.innerText = count;
};

window.filterCompleterList = () => {
    const input = document.getElementById('completer-search');
    const text = input ? input.value.trim() : '';
    
    // For chip buttons, just hide parent div
    const container = document.getElementById('completer-list-container');
    if(!container) return;
    const items = container.querySelectorAll('.completer-chip-btn');
    items.forEach(btn => {
        const name = btn.innerText;
        if (name.includes(text)) btn.style.display = 'block'; // Or flex/inline-block
        else btn.style.display = 'none';
    });
};

window.updateCompleterCount = () => {
    const checked = document.querySelectorAll('.completer-checkbox:checked').length;
    const countSpan = document.getElementById('completer-selected-count');
    if(countSpan) countSpan.innerText = checked;
};

// Staff Settings
window.openStaffSettingsModal = () => {
    const modal = document.getElementById('staffSettingsModal');
    if(!modal) return;
    window.loadStaffConfig().then(() => {
        window.renderStaffManagementList();
        modal.classList.add('active');
    });
};

window.renderStaffManagementList = () => {
    const list = document.getElementById('staff-management-list');
    if(!list) return;
    list.innerHTML = '';
    
    const sorted = [...window.trainingStaffList].sort(); 

    sorted.forEach(name => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '10px';
        li.style.borderBottom = '1px solid #f1f5f9';
        
        li.innerHTML = `
            <span style="font-weight:500;">${name}</span>
            <button class="btn-text" style="color:#ef4444;" onclick="window.removeStaffMember('${name}')"><i class="fas fa-times"></i></button>
        `;
        list.appendChild(li);
    });
};

window.addStaffMember = async () => {
    const input = document.getElementById('new-staff-name');
    if(!input) return;
    const name = input.value.trim();
    if (!name) return;
    
    if (!window.trainingStaffList.includes(name)) {
        window.trainingStaffList.push(name);
        await window.saveStaffConfig();
        if(window.logUserAction) window.logUserAction('training', '수정', `실무 위원 추가: ${name}`);
        window.renderStaffManagementList();
        input.value = '';
    } else {
        alert("이미 존재하는 이름입니다.");
    }
};

window.removeStaffMember = async (name) => {
    if (!confirm(`${name} 님을 목록에서 삭제하시겠습니까?`)) return;
    window.trainingStaffList = window.trainingStaffList.filter(n => n !== name);
    await window.saveStaffConfig();
    if(window.logUserAction) window.logUserAction('training', '삭제', `실무 위원 삭제: ${name}`);
    window.renderStaffManagementList();
};

window.saveStaffConfig = async () => {
    const db = getTrainingDb();
    if (!db) return;
    try {
        await db.collection("settings").doc("staff").set({
            list: window.trainingStaffList
        });
    } catch (e) {
        console.error("Save staff config error:", e);
        alert("설정 저장 실패");
    }
};
