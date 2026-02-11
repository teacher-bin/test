
// ==========================================
// Curriculum & Academic Calendar Logic
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // Only init if the section exists
    if (!document.getElementById("curriculum-section")) return;

    // --- State Variables ---
    let currDate = new Date(); // Current view date (1st of month usually)
    let currViewMode = 'table'; // 'table' or 'calendar'
    let currEvents = []; // Loaded events
    let calendarInstance = null; // FullCalendar instance
    
    // Member Confirm State
    let currMembers = []; 
    // Data structure: { "1": { "교장": "확인", ... }, "2": { ... } } (Keys are month numbers as strings)
    let currYearlyData = {}; 
    let loadedYear = null;

    // --- DOM Elements ---
    const section = document.getElementById("curriculum-section");
    const titlePeriod = document.getElementById("curriculum-current-period");
    const viewBtns = document.querySelectorAll(".view-btn");
    const tableView = document.getElementById("curr-table-view");
    const calendarView = document.getElementById("curr-calendar-view");
    const tableBody = document.getElementById("curr-table-body");
    
    // Modal Elements
    const currModal = document.getElementById("currModal");
    const typeSelectorStep = document.getElementById("curr-type-selector");
    const eventFormStep = document.getElementById("currEventForm");
    const typeCards = document.querySelectorAll(".type-card");
    const backTypeBtn = document.getElementById("curr-back-type-btn");
    const formDynamicFields = document.getElementById("curr-dynamic-fields");
    
    // --- Initialization ---
    // 기존의 이벤트 리스너 방식 대신, 확실한 폴링(Polling) 방식으로 변경
    const checkFirebaseAndInit = () => {
        if (window.db && window.firebaseReady) {
            console.log("Curriculum: Firebase detected. Initializing...");
            initCurriculum();
        } else {
            console.log("Curriculum: Waiting for Firebase...");
            setTimeout(checkFirebaseAndInit, 100); // 100ms 마다 체크
        }
    };
    checkFirebaseAndInit();

    async function initCurriculum() {
        console.log("Curriculum: Starting Initial Render...");
        
        // 1. 기본 UI 설정 및 즉시 렌더링 (빈 화면 방지)
        setupEventListeners();
        updatePeriodDisplay();
        renderCurrentView(); // [중요] 데이터 없어도 일단 달력을 그린다!
        
        // window 객체에 렌더링 함수 노출 (script.js에서 사용 가능하도록)
        window.renderCurriculum = () => {
             console.log("Forced curriculum render");
             // 데이터가 없다면 다시 로드 시도
             if(!currEvents || currEvents.length === 0) loadCurriculumEvents().then(renderCurrentView);
             else renderCurrentView();
        };

        // 2. 비동기 데이터 로딩 (백그라운드)
        console.log("Curriculum: Loading Data...");
        try {
            await Promise.all([
                loadCurriculumEvents(),
                loadMemberConfig(),
                loadYearlyData(currDate.getFullYear())
            ]);
            console.log("Curriculum: Data Loaded. Re-rendering...");
            renderCurrentView(); // 데이터 채워진 후 다시 그리기
        } catch (err) {
            console.error("Curriculum: Data Load Failed", err);
        }
    }



    // --- Data Loading ---
    async function loadCurriculumEvents() {
        const { db, firestoreUtils } = window;
        try {
            // Using a single collection for now
            const q = firestoreUtils.query(firestoreUtils.collection(db, "curriculum_events"));
            const querySnapshot = await firestoreUtils.getDocs(q);
            
            currEvents = [];
            querySnapshot.forEach((doc) => {
                currEvents.push({ id: doc.id, ...doc.data() });
            });
        } catch (e) {
            console.error("Error loading events:", e);
        }
    }

    async function loadMemberConfig() {
        const { db, firestoreUtils } = window;
        if(!db) return;
        try {
            const docRef = firestoreUtils.doc(db, "settings", "curriculum_members");
            const docSnap = await firestoreUtils.getDoc(docRef);
            
            // Defense against docSnap.exists is not a function
            const exists = (docSnap && typeof docSnap.exists === 'function') ? docSnap.exists() : (docSnap && docSnap.exists);

            if (exists) {
                const list = (typeof docSnap.data === 'function' ? docSnap.data() : docSnap.data).list;
                if (Array.isArray(list) && list.length > 0) {
                    currMembers = list;
                } else {
                    console.warn("Empty member list in DB.");
                }
            } else {
                // DO NOT auto-init default members here to prevent overwriting on load failure.
            }
        } catch (e) {
            console.error("Error loading member config:", e);
        }
    }

    async function loadYearlyData(year) {
        const { db, firestoreUtils } = window;
        if(!db) return;
        
        // Prevent reloading same year if not needed, or force reload?
        // Let's force reload if year changes
        if (loadedYear === year) return;

        try {
            const docRef = firestoreUtils.doc(db, "curriculum_yearly_confirms", String(year));
            const docSnap = await firestoreUtils.getDoc(docRef);
            
            const exists = (docSnap && typeof docSnap.exists === 'function') ? docSnap.exists() : (docSnap && docSnap.exists);

            if (exists) {
                currYearlyData = (typeof docSnap.data === 'function' ? docSnap.data() : docSnap.data);
            } else {
                currYearlyData = {};
            }
            loadedYear = year;
        } catch (e) {
            console.error("Error loading yearly data:", e);
            currYearlyData = {}; // Safety fallback
        }
    }

    function renderMemberConfirmBar() {
        const bar = document.getElementById("curr-member-confirm-bar");
        if(!bar) return;

        const currentMonthKey = String(currDate.getMonth() + 1); // "1", "2", ...
        const currentMonthData = currYearlyData[currentMonthKey] || {};

        if (currMembers.length === 0) {
            bar.innerHTML = `
                <div class="no-members-msg" style="padding: 1rem; text-align: center; color: #666;">
                    교직원 목록이 설정되지 않았습니다. 
                    <button class="curr-btn-sm" onclick="window.openMemberSettingsModal()" style="margin-left: 10px;">설정하기</button>
                </div>`;
            return;
        }

        let html = `
            <button class="member-settings-btn" onclick="window.openMemberSettingsModal()" title="구성원 목록 설정">
                <i class="fas fa-cog"></i>
            </button>
            <table class="confirm-table">
                <thead>
                    <tr>
                        <th class="row-label">구분</th>
                        ${currMembers.map(m => `<th>${m}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="row-label">확인</td>
                        ${currMembers.map(m => {
                            const status = currentMonthData[m] || '미확인';
                            const statusClass = status === '확인' ? 'status-confirmed' : 'status-unconfirmed';
                            return `
                                <td>
                                    <select class="confirm-select ${statusClass}" onchange="window.handleConfirmChange('${m}', this.value)">
                                        <option value="미확인" ${status === '미확인' ? 'selected' : ''}>미확인</option>
                                        <option value="확인" ${status === '확인' ? 'selected' : ''}>확인</option>
                                    </select>
                                </td>
                            `;
                        }).join('')}
                    </tr>
                </tbody>
            </table>
        `;
        bar.innerHTML = html;
    }

    window.handleConfirmChange = async (member, value) => {
        const { db, firestoreUtils } = window;
        if (!db) {
             alert("데이터베이스 연결 대기 중입니다.");
             return;
        }

        const currentMonthKey = String(currDate.getMonth() + 1);
        const currentYear = String(currDate.getFullYear());

        // Optimistic Update in Memory
        if (!currYearlyData[currentMonthKey]) {
            currYearlyData[currentMonthKey] = {};
        }
        
        const previousStatus = currYearlyData[currentMonthKey][member];
        currYearlyData[currentMonthKey][member] = value;
        
        renderMemberConfirmBar(); // Re-render immediately
        
        try {
            // Prepare update object: { "3": { "교장": "확인", ... } }
            // Firestore merge will merge top-level fields. 
            // BUT if we want to merge DEEP inside month, we need dot notation?
            // No, the structure is Month -> Map of members.
            // If we save { "3": currentMonthMap }, it replaces the whole map for "3". This is fine as we have the full map in memory.
            
            const updatePayload = {};
            updatePayload[currentMonthKey] = currYearlyData[currentMonthKey];

            const docRef = firestoreUtils.doc(db, "curriculum_yearly_confirms", currentYear);
            await firestoreUtils.updateDoc(docRef, updatePayload);
        } catch (e) {
            console.error("Error saving status:", e);
            // Revert logic
            currYearlyData[currentMonthKey][member] = previousStatus;
            renderMemberConfirmBar();
            alert("저장 중 오류가 발생했습니다: " + e.message);
        }
    };

    // --- Member Settings Modal Logic ---
    window.openMemberSettingsModal = () => {
        const modal = document.getElementById("memberSettingsModal");
        const textarea = document.getElementById("member-list-input");
        if(modal && textarea) {
            // If empty, show default as a suggestion in textarea
            if (currMembers.length === 0) {
                textarea.value = "교장, 교감, 행정실장, 유치원, 1-2학년, 3학년, 4학년, 5학년, 6학년, 전담, 영양";
            } else {
                textarea.value = currMembers.join(", ");
            }
            modal.classList.add("active");
        }
    };

    window.closeMemberSettingsModal = () => {
        const modal = document.getElementById("memberSettingsModal");
        if(modal) modal.classList.remove("active");
    };

    window.saveMemberSettings = async () => {
        const textarea = document.getElementById("member-list-input");
        if(!textarea) return;

        const newMembersStr = textarea.value;
        const newList = newMembersStr.split(",").map(m => m.trim()).filter(m => m !== "");
        
        if (newList.length === 0) {
            alert("구성원 목록을 입력해주세요.");
            return;
        }

        const { db, firestoreUtils } = window;
        if (!db) {
            alert("데이터베이스 연결 대기 중...");
            return;
        }

        try {
            const docRef = firestoreUtils.doc(db, "settings", "curriculum_members");
            await firestoreUtils.setDoc(docRef, { list: newList });
            currMembers = newList;
            renderMemberConfirmBar();
            alert("구성원 목록이 안전하게 저장되었습니다.");
            closeMemberSettingsModal();
        } catch (e) {
            console.error("Error saving members:", e);
            alert("저장 중 오류가 발생했습니다: " + e.message);
        }
    };

    // --- Event Listeners ---
    function setupEventListeners() {
        // View Switcher
        viewBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const view = btn.dataset.currView;
                viewBtns.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                currViewMode = view;
                
                // Delegate all rendering logic to the main render function
                renderCurrentView();
            });
        });

        // Navigation
        document.getElementById("curr-prev-btn").addEventListener("click", () => changeMonth(-1));
        document.getElementById("curr-next-btn").addEventListener("click", () => changeMonth(1));
        document.getElementById("curr-today-btn").addEventListener("click", async () => {
            currDate = new Date(); 
            updatePeriodDisplay();
            await loadYearlyData(currDate.getFullYear());
            renderCurrentView();
        });

        // Mouse Wheel Scroll on Period Display
        const periodDisplay = document.getElementById("curriculum-current-period");
        if (periodDisplay) {
            periodDisplay.addEventListener("wheel", (e) => {
                e.preventDefault();
                if (e.deltaY < 0) {
                    changeMonth(-1); // Scroll Up -> Prev Month
                } else {
                    changeMonth(1);  // Scroll Down -> Next Month
                }
            }, { passive: false });
        }

        // Add Button
        const addBtn = document.getElementById("curr-add-btn");
        if(addBtn) addBtn.addEventListener("click", () => openCurrModal());

        // Export Buttons
        const excelBtn = document.getElementById("curr-excel-btn");
        if(excelBtn) excelBtn.addEventListener("click", () => exportCurriculum('excel'));
        
        const hwpBtn = document.getElementById("curr-hwp-btn");
        if(hwpBtn) hwpBtn.addEventListener("click", () => exportCurriculum('hwp'));

        // Modal: Type Selection
        typeCards.forEach(card => {
            card.addEventListener("click", () => {
                const type = card.dataset.type;
                showEventForm(type);
            });
        });

        // Modal: Back Button
        if(backTypeBtn) backTypeBtn.addEventListener("click", () => {
            eventFormStep.classList.add("hidden");
            typeSelectorStep.classList.remove("hidden");
            currModal.classList.remove('step-2'); // Remove step-2 class
            currModal.querySelector('.modal-header h2').textContent = "새 일정 등록";
        });
        
        // Modal: Close
        document.querySelectorAll(".close-curr-modal").forEach(el => {
            el.addEventListener("click", () => {
                currModal.classList.remove("active");
                currModal.classList.remove('step-2'); // Reset step
            });
        });

        // Form Submit
        if(eventFormStep) eventFormStep.addEventListener("submit", handleEventSubmit);
        
        // Delete Button
        const delBtn = document.getElementById("curr-delete-btn");
        if(delBtn) delBtn.addEventListener("click", handleDeleteEvent);
    }

    async function changeMonth(delta) {
        // Calculate new date safely
        const newDate = new Date(currDate.getFullYear(), currDate.getMonth() + delta, 1);
        
        // Check if year changed
        const oldYear = currDate.getFullYear();
        const newYear = newDate.getFullYear();
        
        currDate = newDate;
        updatePeriodDisplay();

        // Trigger Month Transition Animation (Only for Calendar Mode)
        if (currViewMode === 'calendar') {
            const calendarEl = document.getElementById('curr-fullcalendar');
            if (calendarEl) {
                const animClass = delta > 0 ? 'calendar-anim-next' : 'calendar-anim-prev';
                calendarEl.classList.remove('calendar-anim-next', 'calendar-anim-prev');
                void calendarEl.offsetWidth; // Force Reflow
                calendarEl.classList.add(animClass);
            }
        }

        if (oldYear !== newYear) {
             await loadYearlyData(newYear);
        }
        
        renderCurrentView();
    }

    function updatePeriodDisplay() {
        const y = currDate.getFullYear();
        const m = currDate.getMonth() + 1;
        titlePeriod.textContent = `${y}년 ${m}월`;
    }

    function renderCurrentView() {
        // Always render confirm bar
        renderMemberConfirmBar();

        const tableView = document.getElementById("curr-table-view");
        const calendarView = document.getElementById("curr-calendar-view");

        // Force visibility based on mode
        if(currViewMode === 'table') {
            if(tableView) {
                tableView.classList.add('active');
                tableView.style.display = 'block'; // Failsafe
            }
            if(calendarView) {
                calendarView.classList.remove('active');
                calendarView.style.display = 'none';
            }
            renderTable();
        } else if(currViewMode === 'calendar') {
            if(tableView) {
                tableView.classList.remove('active');
                tableView.style.display = 'none';
            }
            if(calendarView) {
                calendarView.classList.add('active');
                calendarView.style.display = 'block';
            }
            
            // FullCalendar updates itself mostly, but we might need to refetch events
            if(calendarInstance) {
                // Force size update after visibility change
                setTimeout(() => {
                     calendarInstance.updateSize();
                     calendarInstance.render();
                }, 50);

                calendarInstance.refetchEvents();
                calendarInstance.gotoDate(currDate); // Ensure view moves to currDate (Today)
                // Reapply dark mode styles after calendar updates
                if(window.applyCalendarDarkMode) window.applyCalendarDarkMode();
            } else {
                // Initial Render needs small delay too if container was hidden
                setTimeout(() => renderFullCalendar(), 50);
            }
        }
    }

    // --- Table Rendering Logic ---
    function renderTable() {
        const body = document.getElementById("curr-table-body");
        console.log("Curriculum: renderTable called.", { body, date: currDate });

        if(!body) {
            console.error("Curriculum: Table Body Element NOT FOUND!");
            return;
        }
        body.innerHTML = "";

        const y = currDate.getFullYear();
        const m = currDate.getMonth();
        
        const firstDayOfMonth = new Date(y, m, 1);
        const lastDateOfMonth = new Date(y, m + 1, 0).getDate();
        
        // Korean Day Names
        const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

        const autoEvents = (window.KoreanHolidayService ? window.KoreanHolidayService.getAutoEvents(y, m) : []);
        
        // De-duplicate: If an event with same ID exists in DB (currEvents), prefer DB version.
        // Also handle "tombstones" (events recorded in DB just to say they are deleted).
        const dbEventMap = new Map();
        currEvents.forEach(e => dbEventMap.set(e.id, e));

        const filteredAutoEvents = autoEvents.filter(auto => !dbEventMap.has(auto.id));
        const combinedEvents = [...currEvents, ...filteredAutoEvents];

        for(let d = 1; d <= lastDateOfMonth; d++) {
            const dateObj = new Date(y, m, d);
            const dayOfWeek = dateObj.getDay(); // 0=Sun, 6=Sat
            const dateStr = formatDate(dateObj); // YYYY-MM-DD
            
            // ... (dayClass logic)
            let dayClass = "";
            if (dayOfWeek === 0) dayClass = "day-sunday";
            else if (dayOfWeek === 6) dayClass = "day-saturday";

            // Filter events for this day
            const dayEvents = combinedEvents.filter(e => e.start === dateStr && !e.isDeleted);

            // Create Row
            const row = document.createElement("div");
            
            // Check for holiday event
            const isHoliday = dayEvents.some(e => e.isHoliday === true || e.isHoliday === "true");
            row.className = `curr-row ${dayClass}`;
            if (isHoliday) row.classList.add('is-holiday-row');
            
            // Cells
            // 1. Date
            const dateCell = document.createElement("div");
            dateCell.className = "curr-cell date-cell";
            dateCell.dataset.day = d; // Essential for Drag & Drop logic
            
            const todayStr = formatDate(new Date());
            const isToday = (dateStr === todayStr);

            // Refactored Date Number & Badge Logic
            const dateNum = document.createElement("span");
            dateNum.className = isToday ? "date-number today-circle" : "date-number";
            dateNum.textContent = d;

            if (isToday) {
                const badge = document.createElement("span");
                badge.className = "today-badge";
                badge.textContent = "오늘"; // Badge created first to appear on top in flex-col
                dateCell.appendChild(badge);
                dateCell.classList.add("is-today");
            }
            
            dateCell.appendChild(dateNum);
            
            dateCell.onclick = () => {
                if (window.innerWidth <= 768) return; // Restrict modal on mobile
                openCurrModal(dateStr); // Quick Add
            };
            
            // 2. Day
            const dayCell = document.createElement("div");
            dayCell.className = "curr-cell day-cell";
            dayCell.textContent = dayNames[dayOfWeek];

            // 3,4,5,6: SpecialDay(Life), Edu, Staff, Doc
            const lifeCell = createEventCell(dayEvents, 'life', dateStr);
            const eduCell = createEventCell(dayEvents, 'edu', dateStr);
            const staffCell = createEventCell(dayEvents, 'staff', dateStr);
            const docCell = createEventCell(dayEvents, 'doc', dateStr);

            row.append(dateCell, dayCell, lifeCell, eduCell, staffCell, docCell);
            body.appendChild(row);
        }

        // Apply SortableJS to each event-containing cell
        document.querySelectorAll('.curr-table-body .curr-cell:not(.date-cell):not(.day-cell)').forEach(cell => {
            Sortable.create(cell, {
                group: 'curr-events', // Shared group to move between cells
                animation: 150,
                draggable: '.curr-event-chip',
                disabled: window.innerWidth <= 768, // Restrict drag on mobile
                onEnd: async function (evt) {
                    const eventId = evt.item.dataset.id;
                    const targetCell = evt.to;
                    const fromCell = evt.from;
                    const targetRow = targetCell.closest('.curr-row');
                    
                    // Get new Date safely from dataset
                    const newDateDay = targetRow.querySelector('.date-cell').dataset.day;
                    const y = currDate.getFullYear();
                    const m = currDate.getMonth();
                    const newDate = formatDate(new Date(y, m, parseInt(newDateDay)));
                    
                    // Get new Type from column index
                    const colIndex = Array.from(targetRow.children).indexOf(targetCell);
                    const types = ['', '', 'life', 'edu', 'staff', 'doc'];
                    const newType = types[colIndex];

                    // Helper: Get full data if it's an auto event being materialized
                    const getFullFields = (id, baseUpdates) => {
                         const existingDb = currEvents.find(e => e.id === id);
                         if (existingDb) return baseUpdates; // Already in DB, just update fields
                         
                         // Not in DB (Auto Event), need to save ALL fields
                         const original = combinedEvents.find(e => e.id === id);
                         if (original) {
                             return {
                                 title: original.title,
                                 start: original.start,
                                 eventType: original.eventType,
                                 isHoliday: original.isHoliday || false,
                                 ...baseUpdates // Override with new values
                             };
                         }
                         return baseUpdates;
                    };

                    // 1. Update the moved item's basic fields
                    if (eventId && newDate && newType) {
                        const updates = getFullFields(eventId, { start: newDate, eventType: newType });
                        await updateEventField(eventId, updates);
                    }

                    // 2. Update orderIndex for all items in the TARGET cell
                    const targetChips = Array.from(targetCell.querySelectorAll('.curr-event-chip'));
                    for (let i = 0; i < targetChips.length; i++) {
                        const id = targetChips[i].dataset.id;
                        if (id) {
                            const updates = getFullFields(id, { orderIndex: i });
                            await updateEventField(id, updates);
                        }
                    }

                    // 3. If moved to a DIFFERENT cell, update orderIndex for the FROM cell as well
                    if (fromCell !== targetCell) {
                        const fromChips = Array.from(fromCell.querySelectorAll('.curr-event-chip'));
                        for (let i = 0; i < fromChips.length; i++) {
                            const id = fromChips[i].dataset.id;
                            if (id) await updateEventField(id, { orderIndex: i });
                        }
                    }

                    // Refresh widget if exists
                    if (window.updateTodayWidget) window.updateTodayWidget();

                    // [LOG] 학사일정 이동 로그 기록
                    if (window.logUserAction) {
                         const movedEvent = currEvents.find(e => e.id === eventId);
                         const title = movedEvent ? movedEvent.title : '일정';

                         if (fromCell !== targetCell) {
                             // 날짜 또는 타입 변경
                             const fromRow = fromCell.closest('.curr-row');
                             if (fromRow) {
                                 const fromDateDay = fromRow.querySelector('.date-cell').dataset.day;
                                 const oldDate = formatDate(new Date(y, m, parseInt(fromDateDay)));
                                 // newDate는 상단에서 이미 정의됨
                                 
                                 window.logUserAction('curriculum', '이동', `${title} (${oldDate} → ${newDate})`);
                             }
                         } else {
                             // 같은 셀 내 순서 변경
                             window.logUserAction('curriculum', '순서변경', `${title} (${newDate}) 순서 변경`);
                         }
                    }
                }
            });
        });
    }

    // Replace updateEventDate with more flexible updateEventField
    async function updateEventField(id, fields) {
        const { db, firestoreUtils } = window;
         try {
            // Use updateDoc instead of setDoc to only update specified fields
            const updates = { ...fields, updatedAt: new Date().toISOString() };
            await firestoreUtils.updateDoc(firestoreUtils.doc(db, "curriculum_events", id), updates);
            // Sync locally
            const ev = currEvents.find(e => e.id === id);
            if(ev) {
                Object.assign(ev, updates);
            }
        } catch(err) { console.error(err); }
    }

    function createEventCell(events, type, dateString) {
        const cell = document.createElement("div");
        cell.className = "curr-cell";
        
        events
            .filter(e => e.eventType === type)
            .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
            .forEach(ev => {
            const chip = document.createElement("div");
            chip.className = `curr-event-chip chip-type-${type} ${ev.isAuto ? 'is-auto-chip' : ''}`;
            // Remove 'is-auto-chip' class effect via JS if needed, or rely on CSS removal. 
            // We want them to look editable.
            if (ev.isAuto) chip.classList.remove('is-auto-chip');
            chip.dataset.id = ev.id; // Critical for Sortable
            
            // Apply custom colors if exist
            if (ev.backgroundColor) chip.style.backgroundColor = ev.backgroundColor;
            if (ev.textColor) chip.style.color = ev.textColor;
            if (ev.borderColor) chip.style.borderColor = ev.borderColor;

            let displayTitle = ev.title;

            if (type === 'edu') {
                const parts = [];
                if (ev.time) parts.push(ev.time);
                if (ev.place) parts.push(ev.place);
                if (ev.target) parts.push(ev.target);
                if (ev.inCharge) parts.push(`<span class="chip-incharge">${ev.inCharge}</span>`);
                
                if (parts.length > 0) {
                    displayTitle = `${ev.title}(${parts.join(', ')})`;
                }

            } else if (type === 'staff') {
                if (ev.staffStatus) {
                    displayTitle = `${ev.title}(<span class="chip-incharge">${ev.staffStatus}</span>)`;
                    
                    // Standardized HTML Tooltip for Staff
                    const tooltipItems = [
                        { label: '이름', value: ev.title },
                        { label: '복무', value: ev.staffStatus },
                        { label: '사유', value: ev.reason },
                        { label: '장소', value: ev.place },
                        { label: '시간', value: ev.time }
                    ];
                    const tooltipHtml = tooltipItems
                        .filter(item => item.value)
                        .map(item => `
                            <div class="tooltip-item">
                                <div class="tooltip-label-box">
                                    <span class="tooltip-bullet"></span>
                                    <span class="tooltip-label">${item.label}:</span>
                                </div>
                                <div class="tooltip-value">${item.value}</div>
                            </div>
                        `)
                        .join('');
                    
                    chip.onmouseenter = (e) => window.showChipTooltip(e, tooltipHtml);
                    chip.onmouseleave = window.hideChipTooltip;
                }
            } else if (type === 'doc') {
                if (ev.inCharge) {
                    displayTitle = `${ev.title}(<span class="chip-incharge">${ev.inCharge}</span>)`;
                }
                // Store full text for conditional tooltip
                chip.setAttribute('data-full-text', ev.title + (ev.inCharge ? ` (${ev.inCharge})` : ''));
                chip.onmouseenter = (e) => window.handleDocTooltip(e, chip);
                chip.onmouseleave = window.hideChipTooltip;
            }

            // Custom prefix for checkable docs
            let prefixHtml = '';
            if (type === 'doc') {
                chip.classList.add('doc-chip'); // Marker for styling
                 // Prevent bubble to cell, allow checkbox only
                prefixHtml = `<input type="checkbox" class="doc-checkbox" ${ev.isCompleted ? 'checked' : ''} onclick="window.toggleDocComplete('${ev.id}', this)">`;
            }

            // [New Badge Logic]
            // Check if created or updated within last 3 days
            const now = new Date();
            const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
            const eventTime = ev.updatedAt ? new Date(ev.updatedAt) : (ev.createdAt ? new Date(ev.createdAt) : null);
            let badgeHtml = '';
            
            if (eventTime && (now - eventTime) < threeDaysMs) {
                badgeHtml = `
                    <div class="new-badge" style="
                        position: absolute;
                        top: -6px;
                        left: -6px;
                        width: 16px;
                        height: 16px;
                        background-color: #ef4444; 
                        color: white;
                        font-family: 'Inter', sans-serif;
                        font-size: 9px;
                        font-weight: 800;
                        border-radius: 50%;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        z-index: 10;
                        box-shadow: 0 1px 2px rgba(0,0,0,0.15);
                        border: 1.5px solid white;
                        pointer-events: none;
                    ">N</div>
                `;
            }

            chip.innerHTML = `
                ${badgeHtml}
                ${prefixHtml}
                <span class="chip-text ${ev.isCompleted ? 'completed-text' : ''}">${displayTitle}</span>
                <div class="chip-controls">
                    <button class="chip-btn edit" onclick="window.editCurrEvent('${ev.id}')" title="수정"><i class="fas fa-pencil-alt"></i></button>
                    <button class="chip-btn duplicate" onclick="window.duplicateCurrEvent('${ev.id}')" title="복제"><i class="fas fa-copy"></i></button>
                    <button class="chip-btn delete" onclick="window.deleteCurrEventBubble('${ev.id}')" title="삭제"><i class="fas fa-trash"></i></button>
                </div>
            `;
            cell.appendChild(chip);
        });
        
        // Add "Add Event" Button (Hover only)
        const addBtn = document.createElement("button");
        addBtn.className = "cell-add-btn";
        addBtn.innerHTML = '<i class="fas fa-plus"></i>';
        addBtn.title = "이 일정 칸에 추가";
        // Pass both date and type to the modal opener
        // Note: openCurrModal needs to handle the second 'type' argument to pre-select it
        addBtn.onclick = (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 768) return; // Restrict modal on mobile
            window.openCurrModal(dateString, type); 
        };
        cell.appendChild(addBtn);

        return cell;
    }

    // --- FullCalendar Logic ---
    function renderFullCalendar(viewType = 'dayGridMonth') {
        const calendarEl = document.getElementById('curr-fullcalendar');
        if(!calendarEl) return;

        // [New] Scroll to Change Month Logic (Only for Calendar Mode)
        let scrollAccumulator = 0;
        let lastScrollMoveTime = 0;

        calendarEl.addEventListener('wheel', (e) => {
            if (currViewMode !== 'calendar') return;

            const isAtBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 30);
            const isAtTop = window.scrollY <= 30;

            // Only trigger when at vertical boundaries
            if ((e.deltaY > 0 && isAtBottom) || (e.deltaY < 0 && isAtTop)) {
                scrollAccumulator += e.deltaY;
                
                const now = Date.now();
                if (now - lastScrollMoveTime > 800) { // 0.8s cooldown to prevent multiple jumps
                    if (Math.abs(scrollAccumulator) > 150) { // Scroll intensity threshold
                        const delta = scrollAccumulator > 0 ? 1 : -1;
                        changeMonth(delta);
                        scrollAccumulator = 0;
                        lastScrollMoveTime = now;
                        
                        // 시각적 피드백이나 알림이 필요하다면 여기에 추가 (예: 작은 토스트 알림)
                    }
                }
            } else {
                scrollAccumulator = 0;
            }
        }, { passive: true });

        // Determine view
        let initialView = 'dayGridMonth';

        if(calendarInstance) {
            calendarInstance.destroy(); // Clear old to rebuild correctly
        }

        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            initialView: initialView,
            initialDate: currDate,
            locale: 'ko',
            headerToolbar: false, 
            height: 'auto',
            editable: window.innerWidth > 768, // Disable editing on mobile
            events: function(info, successCallback) {
                // 1. Get DB Events
                const dbEvents = [...currEvents];
                
                // 2. Generate Auto Events for the range
                const generatedAutoEvents = [];
                let start = new Date(info.start);
                const end = new Date(info.end);
                while (start < end) {
                    const year = start.getFullYear();
                    const month = start.getMonth();
                    if(window.KoreanHolidayService) {
                        generatedAutoEvents.push(...window.KoreanHolidayService.getAutoEvents(year, month));
                    }
                    start.setMonth(start.getMonth() + 1);
                    start.setDate(1); 
                }

                // 3. Filter DB Events (Only show 'edu' in Monthly Calendar for simplicity)
                const filteredDbEvents = dbEvents.filter(e => e.eventType === 'edu');
                
                // 4. Filter Auto Events (Special days are handled in dayCellContent)
                const dbEventIds = new Set(filteredDbEvents.map(e => e.id));
                const filteredAutoEvents = generatedAutoEvents.filter(auto => {
                    // Hide all auto events from the main calendar chip list
                    return false; 
                });

                successCallback([...filteredDbEvents, ...filteredAutoEvents]);
            },
            eventDataTransform: function(eventData) {
                if (eventData.isAuto) {
                    eventData.editable = false;
                }
                return eventData;
            },
            dayCellContent: function(arg) {
                const day = arg.date.getDate();
                const dateStr = formatDate(arg.date);
                const year = arg.date.getFullYear();
                const month = arg.date.getMonth();
                
                const todayStr = formatDate(new Date());
                let html = "";
                
                if (dateStr === todayStr) {
                    html += `<span class="today-badge">오늘</span>`;
                }
                
                html += `<span class="fc-day-number-text">${day}</span>`;
                
                // Collect all "Special Day" titles (Auto + DB manual life events)
                const specialTitles = [];
                
                // 1. Auto events from Holiday Service
                if (window.KoreanHolidayService) {
                    const autoEvents = window.KoreanHolidayService.getAutoEvents(year, month);
                    autoEvents.filter(e => e.start === dateStr).forEach(e => specialTitles.push(e.title));
                }
                
                // 2. Manual 'life' events from DB
                currEvents.filter(e => e.start === dateStr && e.eventType === 'life').forEach(e => specialTitles.push(e.title));
                
                if (specialTitles.length > 0) {
                    const joined = [...new Set(specialTitles)].join(', '); // Deduplicate and join
                    html += `<div class="fc-special-days-list">`;
                    html += `<span class="fc-special-day-item">${joined}</span>`;
                    html += `</div>`;
                }
                
                return { html: html };
            },
            eventClick: function(info) {
                if (info.event.extendedProps.isAuto) return;
                const eventObj = currEvents.find(e => e.id === info.event.id);
                if(eventObj) openCurrModal(null, eventObj);
            },
            eventDrop: async function(info) {
                const newDate = formatDate(info.event.start);
                const eventId = info.event.id;
                
                if(confirm(`일정을 ${newDate}로 이동하시겠습니까?`)) {
                    await updateEventField(eventId, { start: newDate });
                    if(window.logUserAction) {
                        window.logUserAction('curriculum', '이동', `${info.event.title} 일정을 ${newDate}로 이동`);
                    }
                } else {
                    info.revert();
                }
            },
            // Color weekends in FullCalendar
            dayCellClassNames: function(arg) {
                if (arg.date.getDay() === 0) return ['fc-day-sun'];
                if (arg.date.getDay() === 6) return ['fc-day-sat'];
                return [];
            }
        });
        calendarInstance.render();
        
        // Apply dark mode styles to calendar headers
        applyCalendarDarkMode();
    }
    
    // Global function to apply dark mode styles to FullCalendar headers
    let calendarObserver = null;

    window.applyCalendarDarkMode = function() {
        const calendarEl = document.getElementById('curr-fullcalendar');
        if (!calendarEl) return;

        // Function to apply styles
        const applyStyles = () => {
            if (!document.body.classList.contains('dark-mode')) return;

            // Target ALL potential wrapper elements in the header
            const targets = calendarEl.querySelectorAll(
                '.fc-col-header, .fc-col-header-cell, .fc-scrollgrid-section-header, .fc-scrollgrid-section-header table, .fc-scrollgrid-section-header > div, th'
            );
            
            targets.forEach(el => {
                // Remove inline background styles that might override classes
                el.style.background = '';
                el.style.backgroundColor = '';
                
                // Force transparent background via direct property
                el.style.setProperty('background', 'transparent', 'important');
                el.style.setProperty('background-color', 'transparent', 'important');
                el.style.setProperty('border-color', 'rgba(148, 163, 184, 0.15)', 'important');
            });

            // Specific Border & Padding for cells
            calendarEl.querySelectorAll('.fc-col-header-cell').forEach(cell => {
                cell.style.setProperty('border-bottom', '2px solid rgba(148, 163, 184, 0.25)', 'important');
                cell.style.setProperty('padding', '1rem 0', 'important');
            });

            // Text Styles
            calendarEl.querySelectorAll('.fc-col-header-cell-cushion').forEach(el => {
                el.style.setProperty('color', '#e2e8f0', 'important');
                el.style.setProperty('font-weight', '700', 'important');
            });

            // Special Days (Sun/Sat) - Apply colored background
            calendarEl.querySelectorAll('.fc-col-header-cell.fc-day-sun').forEach(cell => {
                cell.style.setProperty('background', 'rgba(239, 68, 68, 0.08)', 'important');
                cell.style.setProperty('background-color', 'rgba(239, 68, 68, 0.08)', 'important');
                const cushion = cell.querySelector('.fc-col-header-cell-cushion');
                if(cushion) {
                    cushion.style.setProperty('color', '#fca5a5', 'important');
                    cushion.style.setProperty('font-weight', '800', 'important');
                }
            });

            calendarEl.querySelectorAll('.fc-col-header-cell.fc-day-sat').forEach(cell => {
                cell.style.setProperty('background', 'rgba(59, 130, 246, 0.08)', 'important');
                cell.style.setProperty('background-color', 'rgba(59, 130, 246, 0.08)', 'important');
                const cushion = cell.querySelector('.fc-col-header-cell-cushion');
                if(cushion) {
                    cushion.style.setProperty('color', '#93c5fd', 'important');
                    cushion.style.setProperty('font-weight', '800', 'important');
                }
            });
        };

        // 1. Apply immediately
        applyStyles();

        // 2. Setup Observer to catch re-renders (month change, view change)
        if (calendarObserver) calendarObserver.disconnect();
        
        calendarObserver = new MutationObserver((mutations) => {
            // Apply debounce if needed, but for styling, immediate is better to avoid flash
            applyStyles();
        });

        calendarObserver.observe(calendarEl, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    };




    // --- Modal & Form Logic ---
    window.openCurrModal = (dateStr = null, typeOrEdit = null) => {
        currModal.classList.add("active");
        
        if (typeof typeOrEdit === 'string') {
            // Case A: New Event with specific Type (from Hover Add Button)
            resetModalState();
            if (dateStr) currModal.dataset.tempDate = dateStr;
            showEventForm(typeOrEdit); // Direct jump to form
        } else if (typeOrEdit && typeof typeOrEdit === 'object') {
            // Case B: Edit Mode (passed an event object)
            showEventForm(typeOrEdit.eventType, typeOrEdit);
        } else {
            // Case C: New Mode (General Add Button or Date Cell Click)
            resetModalState();
            if (dateStr) {
                currModal.dataset.tempDate = dateStr;
            }
        }
    };

    function resetModalState() {
        currModal.classList.remove('step-2'); // Reset step class
        typeSelectorStep.classList.remove("hidden");
        eventFormStep.classList.add("hidden");
        document.getElementById("currModalTitle").textContent = "새 일정 등록";
        
        // Reset form values but keep structure (if any static structure existed)
        // However, since we render dynamically, cleaning here is tricky.
        // It's better to clean BEFORE rendering in showEventForm.
        const form = document.getElementById("currEventForm");
        if(form) form.reset();
        
        document.getElementById("curr-delete-btn").classList.add("hidden");
        delete currModal.dataset.tempDate;
    }

    function showEventForm(type, editEvent = null) {
        try {
            // UI Step Control
            const typeSelector = document.getElementById("curr-type-selector");
            const eventForm = document.getElementById("currEventForm");
            
            if (!typeSelector || !eventForm) {
                console.error("Critical elements not found:", { typeSelector, eventForm });
                return;
            }

            // Hide selector, show form
            typeSelector.classList.add("hidden");
            eventForm.classList.remove("hidden");
            currModal.classList.add('step-2');
            
            // Header Update
            const badge = document.getElementById("curr-selected-type-badge");
            if (badge) badge.style.display = 'none';
            
            const titleEl = document.getElementById("currModalTitle");
            if (titleEl) titleEl.textContent = editEvent ? "일정 수정" : "새 일정 등록";

            // Data Preparation
            let startVal = formatDate(new Date());
            if (editEvent && editEvent.start) startVal = editEvent.start;
            else if (currModal.dataset.tempDate) startVal = currModal.dataset.tempDate;

            const eventData = editEvent || {
                eventType: type,
                start: startVal,
                title: (type === 'staff' && window.currentUserName) ? window.currentUserName : '',
                inCharge: (type === 'edu' && window.currentUserName) ? window.currentUserName : '',
                time: '',
                isHoliday: false
            };
            

            // Render Form Body
            renderNewFormUI(type, eventData);
            
            // UI Cleanup
            if (backTypeBtn) backTypeBtn.style.display = 'none';
            const headerBar = document.querySelector('.form-header-bar');
            if (headerBar) headerBar.style.display = 'none';
            
        } catch (e) {
            console.error("Error in showEventForm:", e);
            alert("일정 입력 폼을 구성하는 중 오류가 발생했습니다.\n" + e.message);
        }
    }

    // --- Palette Helpers ---
    window.createPaletteHtml = (id, selectedValue, type='bg') => {
        const colors = type === 'bg' ? 
            ['#ffffff', '#fecaca', '#fed7aa', '#fef08a', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#f1f5f9'] :
            ['#000000', '#dc2626', '#c2410c', '#a16207', '#15803d', '#1d4ed8', '#7e22ce', '#475569'];
        
        const defaultVal = type === 'bg' ? '#ffffff' : '#000000';
        const current = (selectedValue || defaultVal).toLowerCase();

        let html = `<div class="color-palette" id="${id}-palette">`;
        colors.forEach(c => {
            const isSel = current === c;
            html += `<div class="palette-item ${isSel?'selected':''}" style="background-color:${c}" data-value="${c}" onclick="window.selectPaletteItem('${id}', this)"></div>`;
        });
        html += `<input type="hidden" id="${id}" value="${current}">`;
        html += `</div>`;
        return html;
    };

    window.selectPaletteItem = (id, el) => {
        document.querySelectorAll(`#${id}-palette .palette-item`).forEach(i => i.classList.remove('selected'));
        el.classList.add('selected');
        document.getElementById(id).value = el.dataset.value;
    };

    function renderNewFormUI(type, data) {
        const form = document.getElementById('currEventForm');
        if (!form) return;
        
        try {
            form.innerHTML = "";

            // 1. Tabs
            const types = [
                { id: 'edu', label: '교육활동' },
                { id: 'staff', label: '교직원 복무' },
                { id: 'doc', label: '처리할 공문' },
                { id: 'life', label: '특별일' }
            ];
            
            let html = `<div class="curr-type-tabs">`;
            types.forEach(t => {
                const activeClass = t.id === type ? 'active' : '';
                html += `<button type="button" class="curr-type-tab ${activeClass}" onclick="window.switchCurrType('${t.id}')">${t.label}</button>`;
            });
            html += `</div>`;

            // Hidden IDs
            html += `
                <input type="hidden" id="curr-event-id" value="${data.id || ''}">
                <input type="hidden" id="curr-event-type" value="${type}">
            `;

            // 2. Date & Title (Common)
            html += `
                <div class="curr-form-row">
                    <div class="curr-form-group" style="flex: 1;">
                        <label class="curr-label">날짜</label>
                        <input type="date" id="curr-date" class="curr-input" value="${data.start || ''}" required>
                    </div>
                    ${type === 'life' ? `
                    <label class="holiday-check-wrapper">
                        <input type="checkbox" id="curr-is-holiday" ${data.isHoliday ? 'checked' : ''}>
                        <span>공휴일</span>
                    </label>
                    ` : ''}
                </div>

                ${type === 'doc' ? `
                    <div class="doc-bulk-container">
                        <label class="curr-label">공문 목록</label>
                        <div id="doc-bulk-list"></div>
                        <button type="button" class="add-doc-row-btn" onclick="window.addDocRow()">
                            <i class="fas fa-plus"></i> 문서 추가
                        </button>
                    </div>
                ` : `
                    <div class="curr-form-row">
                        <div class="curr-form-group">
                            <label class="curr-label required" id="curr-title-label">
                                ${type === 'edu' ? '활동명' : (type === 'staff' ? '작성자(표시용)' : '행사/기념일 명')}
                            </label>
                            <input type="text" id="curr-title" class="curr-input" value="${data.title || ''}" placeholder="내용을 입력하세요" required>
                        </div>
                    </div>
                `}
            `;

            // 3. Type Specific Fields (REORDERED for Staff)
            
            // A. Staff: Status -> Reason -> Place
            if (type === 'staff') {
                const statusOptions = ['출장', '연가', '병가', '공가', '특별휴가', '결근', '연수', '직접 입력'];
                const currentStatus = data.staffStatus || '';
                // '기타' logic: if currentStatus is not in fixed list (excluding '직접 입력'), it's manual
                const fixedOptions = statusOptions.slice(0, -1); 
                const isManual = currentStatus && !fixedOptions.includes(currentStatus);
                const activeVal = isManual ? '직접 입력' : currentStatus;

                html += `
                    <div class="curr-form-row">
                        <div class="curr-form-group">
                            <label class="curr-label required">근무 상황</label>
                            <div class="status-picker-container">
                                <div class="status-chips">
                                    ${statusOptions.map(opt => `
                                        <button type="button" class="status-chip ${activeVal === opt ? 'active' : ''}" 
                                                onclick="window.selectStaffStatus('${opt}')">
                                            ${opt}
                                        </button>
                                    `).join('')}
                                </div>
                                <div id="staff-status-manual-wrap" class="${activeVal === '직접 입력' ? '' : 'hidden'}" style="flex: 1; min-width: 180px;">
                                    <input type="text" id="curr-staff-status-manual" class="curr-input" 
                                           style="margin: 0; height: 32px; padding: 0 10px !important;"
                                           value="${isManual ? currentStatus : ''}" 
                                           placeholder="내용 입력..." 
                                           oninput="window.updateManualStatus(this.value)">
                                </div>
                                <input type="hidden" id="curr-staff-status" value="${currentStatus}" required>
                            </div>
                        </div>
                    </div>
                    <div class="curr-form-row">
                        <div class="curr-form-group">
                            <label class="curr-label">사유</label>
                            <input type="text" id="curr-reason" class="curr-input" value="${data.reason || ''}" placeholder="예: 개인 사정, 병원 진료">
                        </div>
                    </div>
                    <div class="curr-form-row">
                        <div class="curr-form-group">
                            <label class="curr-label">장소</label>
                            <input type="text" id="curr-place" class="curr-input" value="${data.place || ''}" placeholder="예: 관내, 서울">
                        </div>
                    </div>
                `;
            }

            // B. Edu: Extra Fields BEFORE Time
            if (type === 'edu') {
                html += `
                    <div class="curr-form-row">
                        <div class="curr-form-group">
                            <label class="curr-label">장소</label>
                            <input type="text" id="curr-place" class="curr-input" value="${data.place || ''}" placeholder="예: 강당">
                        </div>
                        <div class="curr-form-group">
                            <label class="curr-label">대상</label>
                            <input type="text" id="curr-target" class="curr-input" value="${data.target || ''}" placeholder="예: 전교생">
                        </div>
                    </div>
                    <div class="curr-form-row">
                        <div class="curr-form-group">
                            <label class="curr-label">담당자</label>
                            <input type="text" id="curr-incharge" class="curr-input" value="${data.inCharge || ''}" placeholder="성명 (선택)">
                        </div>
                    </div>
                `;
            }

            // 4. Time Input (For all except doc/life)
            if (type !== 'doc' && type !== 'life') {
                const existingTime = data.time || '';
                let initialTab = 'time'; 
                if(existingTime && typeof existingTime === 'string') {
                    if(existingTime.includes('교시')) initialTab = 'class';
                    else if(existingTime.includes('~') || existingTime.includes(':')) initialTab = 'time';
                    else if(existingTime.trim() !== "") initialTab = 'manual';
                }

                html += `
                    <div class="time-selector-container">
                        <div class="time-mode-tabs">
                            <div class="time-mode-tab ${initialTab==='time'?'active':''}" onclick="setTimeMode('time')"><i class="far fa-clock"></i> 시간선택</div>
                            <div class="time-mode-tab ${initialTab==='class'?'active':''}" onclick="setTimeMode('class')"><i class="fas fa-graduation-cap"></i> 교시선택</div>
                            <div class="time-mode-tab ${initialTab==='manual'?'active':''}" onclick="setTimeMode('manual')"><i class="fas fa-keyboard"></i> 직접입력</div>
                        </div>
                        <div id="time-input-content" class="time-input-area"></div>
                        <input type="hidden" id="curr-time" value="${existingTime}">
                        <input type="hidden" id="curr-time-mode" value="${initialTab}">
                    </div>
                `;
            } else {
                 html += `<input type="hidden" id="curr-time" value="">`;
            }


            // 6. Colors (Palette) - Hide for doc as it's per-row now
            if (type !== 'doc') {
                html += `
                    <div class="curr-form-row">
                        <div class="curr-form-group">
                            <label class="curr-label">배경색</label>
                            ${window.createPaletteHtml('curr-bg-color', data.backgroundColor, 'bg')}
                        </div>
                        <div class="curr-form-group">
                            <label class="curr-label">글자색</label>
                            ${window.createPaletteHtml('curr-text-color', data.textColor, 'text')}
                        </div>
                        ${data.id ? `<button type="button" class="curr-btn-secondary" style="margin-top:auto;" onclick="resetToTypeDefault('${type}')">기본색 복원</button>` : ''}
                    </div>
                `;
            }
            
            // Apply HTML
            form.innerHTML = html;

            // Initialize Time UI
            if (type !== 'doc' && type !== 'life') {
                setTimeout(() => {
                    const modeEl = document.getElementById('curr-time-mode');
                    const timeEl = document.getElementById('curr-time');
                    if (modeEl && timeEl) renderTimeInputUI(modeEl.value, timeEl.value);
                }, 0);
            }

            // Initialize Doc Rows
            if (type === 'doc') {
                setTimeout(() => {
                    const list = document.getElementById('doc-bulk-list');
                    if (list && list.children.length === 0) {
                        window.addDocRow(
                            data.title || '', 
                            data.inCharge || '', 
                            data.backgroundColor || '#ffffff',
                            data.textColor || '#000000'
                        );
                    }
                }, 0);
            }

        } catch (e) {
            console.error("Error in renderNewFormUI:", e);
            form.innerHTML = `<div style="color:red; padding:2rem; font-weight:700;">폼 렌더링 중 오류가 발생했습니다.<br>${e.message}</div>`;
        }
    }

    // Global helper for Type switching
    window.switchCurrType = (newType) => {
        const dateEl = document.getElementById('curr-date');
        const idEl = document.getElementById('curr-event-id');
        const titleEl = document.getElementById('curr-title');
        
        const currentData = {
            id: idEl ? idEl.value : '',
            start: dateEl ? dateEl.value : formatDate(new Date()),
            title: titleEl ? titleEl.value : ''
        };
        showEventForm(newType, currentData); 
    };

    // Time Input UI Logic
    window.setTimeMode = (mode) => {
        document.getElementById('curr-time-mode').value = mode;
        document.querySelectorAll('.time-mode-tab').forEach(el => el.classList.remove('active'));
        
        const tabs = document.querySelectorAll('.time-mode-tab');
        if(mode === 'time') tabs[0].classList.add('active');
        if(mode === 'class') tabs[1].classList.add('active');
        if(mode === 'manual') tabs[2].classList.add('active');

        renderTimeInputUI(mode, document.getElementById('curr-time').value);
    };

    function renderTimeInputUI(mode, currentValue) {
        const container = document.getElementById('time-input-content');
        if(!container) return;

        if (mode === 'manual') {
            container.innerHTML = `<input type="text" id="time-val-manual" class="curr-input" style="width:100%" placeholder="예: 09:00 ~ 10:30" value="${currentValue}">`;
        } else if (mode === 'time') {
            // Default: Empty
            let sH='', sM='', eH='', eM='';
            
            if (currentValue && (currentValue.includes(':') || currentValue.includes('~'))) {
                const parts = currentValue.split('~').map(s => s.trim());
                if (parts[0] && parts[0].includes(':')) {
                    const sParts = parts[0].split(':');
                    sH = sParts[0]; sM = sParts[1];
                }
                if (parts[1] && parts[1].includes(':')) {
                    const eParts = parts[1].split(':');
                    eH = eParts[0]; eM = eParts[1];
                }
            }
            
            const minOpts = (sel) => {
                let html = '<option value="">선택</option>';
                ['00','10','20','30','40','50'].forEach(m => {
                    html += `<option value="${m}" ${m===sel?'selected':''}>${m}</option>`;
                });
                return html;
            };

            container.innerHTML = `
                <select id="time-sh" class="curr-input">${generateTimeOptions(sH)}</select> : 
                <select id="time-sm" class="curr-input">${minOpts(sM)}</select>
                <span class="time-separator">~</span>
                <select id="time-eh" class="curr-input">${generateTimeOptions(eH)}</select> : 
                <select id="time-em" class="curr-input">${minOpts(eM)}</select>
            `;
        } else if (mode === 'class') {
            const classes = Array.from({length:8}, (_,i)=>`${i+1}교시`);
            let scVal = "1교시", ecVal = "1교시";
            if (currentValue && currentValue.includes('교시')) {
                const parts = currentValue.split('~').map(s => s.trim());
                scVal = parts[0];
                ecVal = parts[1] || parts[0];
            }
            container.innerHTML = `
                <select id="time-sc" class="class-select">${classes.map(c=>`<option ${c===scVal?'selected':''}>${c}</option>`).join('')}</select>
                <span class="time-separator">~</span>
                <select id="time-ec" class="class-select">${classes.map(c=>`<option ${c===ecVal?'selected':''}>${c}</option>`).join('')}</select>
            `;
        }
    }

    function generateTimeOptions(selected) {
        let opts = '<option value="">선택</option>';
        for(let i=6; i<=22; i++) { // Range extended for flexibility
            const v = i.toString().padStart(2,'0');
            opts += `<option value="${v}" ${v==selected?'selected':''}>${v}</option>`;
        }
        return opts;
    }

    // --- Firebase Actions ---
    async function handleEventSubmit(e) {
        e.preventDefault();
        
        const eventId = document.getElementById("curr-event-id").value;
        const type = document.getElementById("curr-event-type").value;
        const titleEl = document.getElementById("curr-title");
        const title = titleEl ? titleEl.value : "";
        const date = document.getElementById("curr-date").value;
        
        // Time Assembly Logic
        let time = "";
        const timeMode = document.getElementById("curr-time-mode")?.value;
        if (timeMode === 'manual') {
            time = document.getElementById("time-val-manual")?.value || "";
        } else if (timeMode === 'time') {
            const sh = document.getElementById("time-sh")?.value;
            const sm = document.getElementById("time-sm")?.value;
            const eh = document.getElementById("time-eh")?.value;
            const em = document.getElementById("time-em")?.value;
            
            const startStr = (sh && sm) ? `${sh}:${sm}` : '';
            const endStr = (eh && em) ? `${eh}:${em}` : '';
            
            if(startStr && endStr) time = `${startStr} ~ ${endStr}`;
            else if(startStr) time = `${startStr}~`;
            else if(endStr) time = `~${endStr}`;
            else time = ""; // Both empty
        } else if (timeMode === 'class') {
            const sc = document.getElementById("time-sc")?.value;
            const ec = document.getElementById("time-ec")?.value;
            if(sc && ec) time = (sc === ec) ? sc : `${sc} ~ ${ec}`;
        }

        // Holiday Check
        const isHoliday = document.getElementById("curr-is-holiday")?.checked || false;

        // Construct Data Object
        const eventData = {
            eventType: type,
            title: title,
            start: date, // FullCalendar expects 'start' as YYYY-MM-DD
            time: time,
            isHoliday: isHoliday,
            updatedAt: new Date().toISOString()
        };

        // Specific Fields (Fields might not exist depending on type, use optional chaining or check type)
        if (type === 'edu') {
            eventData.place = document.getElementById("curr-place")?.value || "";
            eventData.target = document.getElementById("curr-target")?.value || "";
            eventData.inCharge = document.getElementById("curr-incharge")?.value || "";
            // Default to White/Black
            eventData.backgroundColor = "#ffffff";
            eventData.textColor = "#000000";
        } else if (type === 'staff') {
            eventData.staffName = title; // Map title to name
            const statusVal = document.getElementById("curr-staff-status")?.value;
            if(!statusVal) {
                alert("근무 상황을 선택해주세요.");
                return;
            }
            eventData.staffStatus = statusVal;
            eventData.reason = document.getElementById("curr-reason")?.value || "";
            eventData.place = document.getElementById("curr-place")?.value || ""; // New Place field
            
            eventData.backgroundColor = "#ffffff";
            eventData.textColor = "#000000";
        } else if (type === 'doc') {
            eventData.inCharge = document.getElementById("curr-doc-incharge")?.value || "";
            eventData.backgroundColor = "#ffffff";
            eventData.textColor = "#000000";
        } else if (type === 'life') {
            eventData.backgroundColor = "#ffffff";
            eventData.textColor = "#000000";
        }
        
        // Color Selection (Palette) - Only for non-doc types
        if (type !== 'doc') {
            const bgColor = document.getElementById("curr-bg-color")?.value || "#ffffff";
            const textColor = document.getElementById("curr-text-color")?.value || "#000000";
            eventData.backgroundColor = bgColor;
            eventData.textColor = textColor;
        }

        // Holiday Style Override (Only if specifically marked and not manually colored)
        if (isHoliday && eventData.backgroundColor === "#ffffff") { 
            eventData.backgroundColor = "#fff5f5";
            eventData.textColor = "#ef4444";
            eventData.borderColor = "#fecaca";
        }

        const { db, firestoreUtils } = window;
        if(window.db) {
            try {
                if (type === 'doc') {
                    const rows = document.querySelectorAll('.curr-doc-bulk-row');
                    const bulkData = [];
                    rows.forEach(row => {
                        const t = row.querySelector('.doc-bulk-title')?.value;
                        const i = row.querySelector('.doc-bulk-incharge')?.value;
                        const b = row.querySelector('.doc-bulk-bg')?.value;
                        const c = row.querySelector('.doc-bulk-text')?.value;
                        if (t) bulkData.push({ title: t, inCharge: i, backgroundColor: b, textColor: c });
                    });

                    if (bulkData.length === 0) {
                        alert("최소 하나의 문서 제목을 입력해주세요.");
                        return;
                    }

                    if (eventId) {
                        const first = bulkData[0];
                        eventData.title = first.title;
                        eventData.inCharge = first.inCharge;
                        eventData.backgroundColor = first.backgroundColor;
                        eventData.textColor = first.textColor;
                        eventData.updatedAt = new Date().toISOString();
                        await firestoreUtils.setDoc(firestoreUtils.doc(db, "curriculum_events", eventId), eventData, { merge: true });
                    } else {
                        for (const item of bulkData) {
                            const newEvent = { 
                                ...eventData, 
                                title: item.title, 
                                inCharge: item.inCharge,
                                backgroundColor: item.backgroundColor,
                                textColor: item.textColor,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            };
                            // Generate unique ID manually
                            const newId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                            await firestoreUtils.setDoc(firestoreUtils.doc(db, "curriculum_events", newId), newEvent);
                        }
                    }
                } else {
                    if (eventId) {
                        eventData.updatedAt = new Date().toISOString();
                        await firestoreUtils.setDoc(firestoreUtils.doc(db, "curriculum_events", eventId), eventData, { merge: true });
                    } else {
                        eventData.createdAt = new Date().toISOString();
                        eventData.updatedAt = new Date().toISOString();
                        // Generate unique ID manually
                        const newId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        await firestoreUtils.setDoc(firestoreUtils.doc(db, "curriculum_events", newId), eventData);
                    }
                }
            
                // Log action - moved outside to log all event types
                if(window.logUserAction) {
                    const typeAction = eventId ? '수정' : '생성';
                    window.logUserAction('curriculum', typeAction, `${eventData.title} 일정 ${typeAction}`);
                }

                currModal.classList.remove("active");
                // Refresh
                await loadCurriculumEvents();
                renderCurrentView(); // Refresh the table/calendar view
                // If calendar open -> refetch
                if(calendarInstance) calendarInstance.refetchEvents();
                // Update Today Widget
                if (window.updateTodayWidget) window.updateTodayWidget();
            } catch (err) {
                console.error(err);
                alert("저장 중 오류가 발생했습니다.");
            }
        } else {
            alert("DB 연결 안됨 (Local Mode?)");
        }
    }

    async function handleDeleteEvent() {
        if(!confirm("정말 삭제하시겠습니까?")) return;
        
        const eventId = document.getElementById("curr-event-id").value;
        const title = document.getElementById("curr-title")?.value || "제목 없음";
        if(!eventId) return;

        const { db, firestoreUtils } = window;
        if(window.db) {
            try {
                await firestoreUtils.deleteDoc(firestoreUtils.doc(db, "curriculum_events", eventId));
                
                if(window.logUserAction) {
                    window.logUserAction('curriculum', '삭제', `${title} 일정 삭제`);
                }

                currModal.classList.remove("active");
                loadCurriculumEvents();
                renderCurrentView(); // Refresh UI after delete from modal
            } catch(err) {
                console.error(err);
            }
        }
    }
    
    window.resetToTypeDefault = (type) => {
        let bg = "#ffffff", text = "#000000";
        // Override with White/Black for all types as per user request
        bg = "#ffffff";
        text = "#000000";

        // Helper to update palette UI
        const updatePalette = (id, val) => {
            const input = document.getElementById(id);
            if(input) input.value = val;
            const container = document.getElementById(id + '-palette');
            if(container) {
                container.querySelectorAll('.palette-item').forEach(item => {
                    if(item.dataset.value === val) item.classList.add('selected');
                    else item.classList.remove('selected');
                });
            }
        };

        updatePalette("curr-bg-color", bg);
        updatePalette("curr-text-color", text);
    };

    // Global exposure for onClick handlers in HTML strings
    window.editCurrEvent = (id) => {
        let ev = currEvents.find(e => e.id === id);
        if (!ev) {
            // Check if it's an auto event for current view
            const y = currDate.getFullYear();
            const m = currDate.getMonth();
            const autoEvents = (window.KoreanHolidayService ? window.KoreanHolidayService.getAutoEvents(y, m) : []);
            ev = autoEvents.find(e => e.id === id);
        }
        
        if(ev) openCurrModal(null, ev);
    };

    window.deleteCurrEventBubble = async (id) => {
        if (window.event) window.event.stopPropagation(); // Stop bubble to cell
        if(!confirm("바로 삭제하시겠습니까?")) return;
        
        const { db, firestoreUtils } = window;
        const isAuto = !currEvents.find(e => e.id === id); // If not in loaded DB events, it's auto

        try {
            let logTitle = "알 수 없는 일정";
            if (isAuto) {
                const y = currDate.getFullYear();
                const m = currDate.getMonth();
                const autoEvents = (window.KoreanHolidayService ? window.KoreanHolidayService.getAutoEvents(y, m) : []);
                const ev = autoEvents.find(e => e.id === id);
                if(ev) logTitle = ev.title;

                await firestoreUtils.setDoc(firestoreUtils.doc(db, "curriculum_events", id), {
                    id: id,
                    isDeleted: true,
                    updatedAt: new Date().toISOString()
                });
            } else {
                const ev = currEvents.find(e => e.id === id);
                if(ev) logTitle = ev.title;
                await firestoreUtils.deleteDoc(firestoreUtils.doc(db, "curriculum_events", id));
            }
            
            if(window.logUserAction) {
                window.logUserAction('curriculum', '삭제', `${logTitle} 일정 삭제 (빠른 삭제)`);
            }

            await loadCurriculumEvents();
            renderCurrentView(); // Crucial: Refresh the UI
            // Update Today Widget
            if (window.updateTodayWidget) window.updateTodayWidget();
        } catch(err) { console.error(err); }
    };
    
    window.duplicateCurrEvent = async (id) => {
        if (window.event) window.event.stopPropagation();
        
        let originalEvent = currEvents.find(e => e.id === id);
        if (!originalEvent) {
             const y = currDate.getFullYear();
             const m = currDate.getMonth();
             const autoEvents = (window.KoreanHolidayService ? window.KoreanHolidayService.getAutoEvents(y, m) : []);
             originalEvent = autoEvents.find(e => e.id === id);
        }
        if (!originalEvent) return;

        if(!confirm("이 일정을 복제하시겠습니까?")) return;

        const { db, firestoreUtils } = window;
        try {
            // Clone data and remove ID
            const newData = { ...originalEvent };
            delete newData.id;
            
            // Adjust title or name
            if (newData.eventType === 'staff' && newData.staffName) {
                // If staff, title is staffName usually
                // But let's just append copy to title which is used for display
                // newData.reason = (newData.reason || '') + " (복사됨)"; 
                // Or maybe just duplicate as is? Usually duplicate implies exact copy.
                // Request said "create similar event easily". A direct copy is best foundation.
                // Let's NOT append text to keep it clean, as user will likely move it or edit it immediately.
                // But to distinguish, maybe slight visual cue? No, exact copy is standard behavior.
            } 
            
            newData.updatedAt = new Date().toISOString();

            const newId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await firestoreUtils.setDoc(firestoreUtils.doc(db, "curriculum_events", newId), newData);
            
            await loadCurriculumEvents();
            renderCurrentView();
            if (window.updateTodayWidget) window.updateTodayWidget();
            
            if(window.logUserAction) {
                window.logUserAction('curriculum', '복제', `${originalEvent.title} 일정 복제`);
            }
            
        } catch (err) {
            console.error("Error duplicating event:", err);
            alert("일정 복제 중 오류가 발생했습니다.");
        }
    };

    window.toggleDocComplete = async (id, checkbox) => {
        if (window.event) window.event.stopPropagation();
        
        const isCompleted = checkbox.checked;
        const { db, firestoreUtils } = window;
        
        // Optimistic UI update
        const chip = checkbox.closest('.curr-event-chip');
        const textSpan = chip.querySelector('.chip-text');
        if(isCompleted) textSpan.classList.add('completed-text');
        else textSpan.classList.remove('completed-text');

        try {
            // Use updateDoc instead of setDoc to only update the field, not replace the document
            await firestoreUtils.updateDoc(firestoreUtils.doc(db, "curriculum_events", id), { 
                isCompleted: isCompleted 
            });
            // Sync local cache
            const ev = currEvents.find(e => e.id === id);
            if(ev) ev.isCompleted = isCompleted;
        } catch(err) {
            console.error("Error toggling completion:", err);
            // Revert on error
            checkbox.checked = !isCompleted;
            if(isCompleted) textSpan.classList.remove('completed-text');
            else textSpan.classList.add('completed-text');
        }
    };

    window.selectStaffStatus = (status) => {
        const hiddenInput = document.getElementById('curr-staff-status');
        const manualWrap = document.getElementById('staff-status-manual-wrap');
        const manualInput = document.getElementById('curr-staff-status-manual');
        
        // Update Chips Active Class
        document.querySelectorAll('.status-chip').forEach(btn => {
            btn.classList.remove('active');
            if(btn.innerText.trim() === status) btn.classList.add('active');
        });

        if (status === '직접 입력') {
            manualWrap.classList.remove('hidden');
            hiddenInput.value = manualInput.value;
            setTimeout(() => manualInput.focus(), 100);
        } else {
            manualWrap.classList.add('hidden');
            hiddenInput.value = status;
        }
    };

    window.updateManualStatus = (val) => {
        const hiddenInput = document.getElementById('curr-staff-status');
        hiddenInput.value = val;
    };


    window.addDocRow = (title = '', inCharge = '', bg = '#ffffff', text = '#000000') => {
        const list = document.getElementById('doc-bulk-list');
        if(!list) return;
        
        const bgColors = ["#ffffff", "#fff5f5", "#fffdeb", "#f0fdf4", "#eff6ff", "#f5f3ff", "#f8fafc"];
        const textColors = ["#000000", "#ef4444", "#d97706", "#16a34a", "#2563eb", "#7c3aed", "#475569"];

        const div = document.createElement('div');
        div.className = 'curr-doc-bulk-row';
        div.innerHTML = `
            <div class="curr-form-group" style="flex: 3;">
                <input type="text" class="curr-input doc-bulk-title" value="${title}" placeholder="문서 제목 *" required>
            </div>
            <div class="curr-form-group" style="flex: 1; min-width: 100px;">
                <input type="text" class="curr-input doc-bulk-incharge" value="${inCharge}" placeholder="담당자">
            </div>
            
            <div class="inline-color-picker">
                <!-- Background Picker -->
                <div class="color-picker-item">
                    <span class="color-label">배경</span>
                    <div class="color-trigger bg-trigger" style="background-color: ${bg}" onclick="window.toggleColorPopover(this)"></div>
                    <div class="color-popover bg-popover">
                        <label style="font-size: 11px; margin-bottom: 5px; display: block; color: #64748b;">배경색 선택</label>
                        <div class="mini-palette">
                            ${bgColors.map(c => `<div class="mini-color-opt" style="background-color: ${c}" onclick="window.selectDocRowColor(this, '${c}', 'bg')"></div>`).join('')}
                        </div>
                    </div>
                </div>
                <!-- Text Picker -->
                <div class="color-picker-item">
                    <span class="color-label">글자</span>
                    <div class="color-trigger text-trigger" style="background-color: ${text}" onclick="window.toggleColorPopover(this)"></div>
                    <div class="color-popover text-popover">
                        <label style="font-size: 11px; margin-bottom: 5px; display: block; color: #64748b;">글자색 선택</label>
                        <div class="mini-palette">
                            ${textColors.map(c => `<div class="mini-color-opt" style="background-color: ${c}" onclick="window.selectDocRowColor(this, '${c}', 'text')"></div>`).join('')}
                        </div>
                    </div>
                </div>
                <input type="hidden" class="doc-bulk-bg" value="${bg}">
                <input type="hidden" class="doc-bulk-text" value="${text}">
            </div>

            <button type="button" class="doc-row-remove-btn" onclick="this.parentElement.remove()" title="행 삭제"><i class="fas fa-times"></i></button>
        `;
        list.appendChild(div);
    };

    window.toggleColorPopover = (el) => {
        const popover = el.nextElementSibling;
        const isActive = popover.classList.contains('active');
        // Close all others first
        document.querySelectorAll('.color-popover').forEach(p => p.classList.remove('active'));
        if(!isActive) popover.classList.add('active');
    };

    window.selectDocRowColor = (el, color, type) => {
        const popover = el.closest('.color-popover');
        const picker = popover.closest('.inline-color-picker');
        const trigger = popover.previousElementSibling;
        
        trigger.style.backgroundColor = color;
        if(type === 'bg') {
            picker.querySelector('.doc-bulk-bg').value = color;
        } else {
            picker.querySelector('.doc-bulk-text').value = color;
        }
        popover.classList.remove('active');
    };

    // --- Improved Tooltip Logic ---
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'calendar-html-tooltip';
    document.body.appendChild(tooltipEl);

    window.showChipTooltip = (e, content) => {
        if (!content) return;
        tooltipEl.innerHTML = content;
        tooltipEl.style.display = 'block';
        
        const updatePosition = (clientX, clientY) => {
            const padding = 15;
            let left = clientX + padding;
            let top = clientY + padding;

            // Flip if overflow right
            if (left + tooltipEl.offsetWidth > window.innerWidth) {
                left = clientX - tooltipEl.offsetWidth - padding;
            }
            // Flip if overflow bottom
            if (top + tooltipEl.offsetHeight > window.innerHeight) {
                top = clientY - tooltipEl.offsetHeight - padding;
            }

            tooltipEl.style.left = left + 'px';
            tooltipEl.style.top = top + 'px';
        };

        updatePosition(e.clientX, e.clientY);
        
        e.target._onMouseMove = (me) => updatePosition(me.clientX, me.clientY);
        e.target.addEventListener('mousemove', e.target._onMouseMove);
    };

    window.hideChipTooltip = (e) => {
        tooltipEl.style.display = 'none';
        if (e.target._onMouseMove) {
            e.target.removeEventListener('mousemove', e.target._onMouseMove);
            delete e.target._onMouseMove;
        }
    };

    window.handleDocTooltip = (e, chip) => {
        const textSpan = chip.querySelector('.chip-text');
        if (!textSpan || !chip.dataset.fullText) return;

        // Check overflow for simple text chips (like doc)
        if (textSpan.scrollWidth > textSpan.clientWidth) {
            const html = `
                <div class="tooltip-item">
                    <span class="tooltip-bullet"></span>
                    <div class="tooltip-value">${chip.dataset.fullText}</div>
                </div>
            `;
            window.showChipTooltip(e, html);
        }
    };

    async function updateEventDate(id, newDate) {
        const { db, firestoreUtils } = window;
         try {
            await firestoreUtils.updateDoc(firestoreUtils.doc(db, "curriculum_events", id), { start: newDate });
            loadCurriculumEvents();
            renderCurrentView();
        } catch(err) { console.error(err); }
    }

    // Helper: Date Format YYYY-MM-DD
    function formatDate(d) {
        const year = d.getFullYear();
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    }

    // --- Export Function ---
    function exportCurriculum(format) {
        const year = currDate.getFullYear();
        const month = currDate.getMonth(); // 0-indexed
        const lastDate = new Date(year, month + 1, 0).getDate();
        const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
        
        // HWP/Excel 호환성을 극대화한 스타일 설정
        let html = `
        <!DOCTYPE html>
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <style>
                @page { margin: 2cm; }
                body { font-family: 'Malgun Gothic', '돋움', Dotum, 'Arial', sans-serif; line-height: 1.4; color: #333; }
                table { border-collapse: collapse; width: 100%; table-layout: fixed; border: 0.5pt solid #000; }
                th, td { border: 0.5pt solid #000; padding: 5pt; vertical-align: top; word-break: break-all; }
                th { background-color: #f2f2f2; font-weight: bold; text-align: center; font-size: 10pt; height: 25pt; }
                td { font-size: 9pt; }
                
                /* Column Widths (HWP 호환을 위해 고정값 지정) */
                .col-date { width: 35pt; text-align: center; }
                .col-day { width: 35pt; text-align: center; }
                .col-special { width: 80pt; color: #1e40af; font-weight: bold; }
                .col-edu { width: 160pt; }
                .col-staff { width: 90pt; }
                .col-doc { width: 90pt; }
                
                .sun, .holiday { color: #ff0000 !important; }
                .sat { color: #0000ff !important; }
                .bullet { margin-right: 3pt; color: #666; }
                .item-container { margin-bottom: 4pt; }
                .title-area { text-align: center; margin-bottom: 20pt; }
                .title-text { font-size: 16pt; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="title-area">
                <span class="title-text">${year}년 ${month + 1}월 학사일정</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th class="col-date">날짜</th>
                        <th class="col-day">요일</th>
                        <th class="col-special">특별일</th>
                        <th class="col-edu">교육활동</th>
                        <th class="col-staff">교직원 복무</th>
                        <th class="col-doc">처리할 공문</th>
                    </tr>
                </thead>
                <tbody>
        `;

        const autoEvents = window.KoreanHolidayService ? window.KoreanHolidayService.getAutoEvents(year, month) : [];
        const combinedEvents = [...currEvents, ...autoEvents];

        for (let d = 1; d <= lastDate; d++) {
            const dateObj = new Date(year, month, d);
            const dayOfWeek = dateObj.getDay();
            const dateStr = formatDate(dateObj);
            
            const dayEvents = combinedEvents.filter(e => e.start === dateStr);
            const isHoliday = dayEvents.some(e => e.isHoliday === true || e.isHoliday === "true");
            
            let dayColor = "#000000";
            if (dayOfWeek === 0 || isHoliday) dayColor = "#ff0000";
            else if (dayOfWeek === 6) dayColor = "#0000ff";

            const bgColor = isHoliday ? "#fff5f5" : (dayOfWeek === 0 ? "#fafafa" : "#ffffff");

            const getEventTexts = (type) => {
                const events = dayEvents
                    .filter(e => e.eventType === type)
                    .sort((a,b) => (a.orderIndex||0) - (b.orderIndex||0));

                if (events.length === 0) return '';

                return events.map(e => {
                    let t = e.title;
                    if (type === 'edu') {
                        const details = [e.time, e.place, e.target, e.inCharge].filter(Boolean).join(', ');
                        if (details) t += ` <span style="color:#555; font-size:8pt;">[${details}]</span>`;
                    } else if (type === 'staff') {
                        if (e.staffStatus) t += `(${e.staffStatus})`;
                        const details = [e.reason, e.place, e.time].filter(Boolean).join(', ');
                        if (details) t += ` <span style="color:#555; font-size:8pt;">- ${details}</span>`;
                    } else if (type === 'doc') {
                        if (e.inCharge) t += `(${e.inCharge})`;
                    }
                    return `<div class="item-container"><span class="bullet" style="margin-right:2px;">•</span>${t}</div>`;
                }).join('');
            };

            const lifeText = dayEvents
                .filter(e => e.eventType === 'life' || e.isHoliday === true || e.isHoliday === "true")
                .map(e => e.title)
                .join(', ');

            html += `
                <tr style="background-color: ${bgColor};">
                    <td class="col-date" style="color: ${dayColor};">${d}</td>
                    <td class="col-day" style="color: ${dayColor};">${dayNames[dayOfWeek]}</td>
                    <td class="col-special">${lifeText || ''}</td>
                    <td class="col-edu">${getEventTexts('edu')}</td>
                    <td class="col-staff">${getEventTexts('staff')}</td>
                    <td class="col-doc">${getEventTexts('doc')}</td>
                </tr>
            `;
        }

        html += `
                </tbody>
            </table>
        </body>
        </html>
        `;

        const blob = new Blob([html], { type: format === 'excel' ? 'application/vnd.ms-excel' : 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const filename = `${year}년_${month + 1}월_학사일정`;
        a.download = format === 'excel' ? `${filename}.xls` : `${filename}.hwp`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});
