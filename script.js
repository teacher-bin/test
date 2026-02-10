document.addEventListener("DOMContentLoaded", () => {
  const linksGrid = document.querySelector("#links-grid");
  const navItems = document.querySelectorAll(".nav-item");
  const digitalClock = document.getElementById("digital-clock");
  const statusSection = document.getElementById("status-section");
  const shortcutSection = document.getElementById("shortcut-section");
  const datayardSection = document.getElementById("datayard-section");
  const curriculumSection = document.getElementById("curriculum-section");
  const helppageSection = document.getElementById("helppage-section");
  const accountSection = document.getElementById("account-section");
  const busSection = document.getElementById("bus-section");
  const calendarSection = document.getElementById("calendar-section");
  const adminSection = document.getElementById("admin-section");
  const statusTabs = document.querySelectorAll(".status-tab");
  const statusPanels = document.querySelectorAll(".status-panel");
  const siteTitle = document.getElementById("site-title");

  // 사이트 제목 클릭 시 '홈' 탭으로 이동
  if (siteTitle) {
    siteTitle.addEventListener("click", () => {
      const homeBtn = document.querySelector('.nav-item[data-category="all"]');
      if (homeBtn) homeBtn.click();
    });
  }

  let currentCategory = "all";
  let calendar = null; // FullCalendar 인스턴스

  // Helper: Check Admin Role
  const isAdmin = () => window.currentUserRole === 'admin' || window.currentUserRole === 'sub-admin';

  // 시간 업데이트 함수
  function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    if (digitalClock) {
      // 구조가 없으면 초기화
      if (!digitalClock.querySelector('.clock-time')) {
        digitalClock.innerHTML = `
          <span class="clock-ampm"></span>
          <div class="clock-time">
              <span class="hh"></span>
              <span class="clock-colon">:</span>
              <span class="mm"></span>
              <span class="clock-seconds"></span>
          </div>
        `;
      }
      
      // 텍스트만 업데이트 (애니메이션 상태 유지)
      digitalClock.querySelector('.clock-ampm').textContent = ampm;
      digitalClock.querySelector('.hh').textContent = String(hours).padStart(2, "0");
      digitalClock.querySelector('.mm').textContent = minutes;
      digitalClock.querySelector('.clock-seconds').textContent = seconds;
    }
  }

  setInterval(updateClock, 1000);
  updateClock();

  // Initialize Shortcuts Logic on Load (Moved from Tab click)
  initShortcuts();

  // Helper: Format Date (YYYY-MM-DD)
  function formatDate(date, offsetDays = 0) {
    let d = new Date(date);
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Make formatDate global if needed or just use consistent logic
  window.formatDate = formatDate;

  // KoreanHolidayService moved to src/utils/holidays.js

  // 카드 렌더링 함수
  function renderCards() {
    linksGrid.innerHTML = "";

    const filteredData = linkData.filter((link) => {
      const matchesCategory =
        currentCategory === "all" || link.category === currentCategory;
      return matchesCategory;
    });

    filteredData.forEach((link) => {
      const card = document.createElement("a");
      card.href = link.url;
      card.target = "_blank";
      card.className = "link-card";

      card.innerHTML = `
                <div class="card-icon">
                    <i class="fas ${link.icon}"></i>
                </div>
                <div class="card-content">
                    <h3>${link.title}</h3>
                    <p>${link.description}</p>
                </div>
            `;

      linksGrid.appendChild(card);
    });
  }

  // 바로가기 상태 관리
  let isEditMode = false;
  let localShortcutData = []; 
  let collapsedGroups = new Set(); // Track collapsed group IDs

  // 자료마당 상태 관리
  let datayardEditMode = false;
  let localDatayardData = [];
  let datayardFileToUpload = null;
  let datayardActiveTab = 'upload';

  // 초기화 및 Firebase 데이터 로드
  async function initShortcuts() {
    if (!window.db) {
       // Firebase 로드 대기
       window.addEventListener('firebase-ready', () => loadShortcutsFromFirebase());
       // fallback: 로컬 데이터 사용 (Firebase 로드 전까지)
       localShortcutData = JSON.parse(JSON.stringify(shortcutData));
       renderShortcuts();
    } else {
       await loadShortcutsFromFirebase();
    }
  }

  async function loadShortcutsFromFirebase() {
    const { db, firestoreUtils } = window;
    try {
      // 1. 그룹 정보 가져오기 (컬렉션 shortcut_groups)
      // 간단하게 구현하기 위해 문서 하나에 전체 JSON을 저장하는 방식을 추천하지만, 
      // 확장성을 위해 개별 문서로 갈 수도 있습니다. 
      // 여기서는 빠른 구현과 무결성을 위해 'settings' 컬렉션의 'shortcuts' 문서를 메인으로 사용하겠습니다.
      // 만약 세부 컬렉션이 필요하다면 마이그레이션이 필요합니다.
      
      const docRef = firestoreUtils.doc(db, "settings", "shortcuts");
      const docSnap = await firestoreUtils.getDocs(firestoreUtils.query(firestoreUtils.collection(db, "settings")));
      // getDoc이 firestoreUtils에 없으므로 query를 이용하거나, 
      // 단일 문서 관리용으로 collection 구조를 잡습니다.
      
      // 편의상 'shortcutGroups' 컬렉션을 사용합니다.
      const q = firestoreUtils.query(firestoreUtils.collection(db, "shortcutGroups"));
      const querySnapshot = await firestoreUtils.getDocs(q);
      
      const loadedData = [];
      querySnapshot.forEach((doc) => {
        loadedData.push({ id: doc.id, ...doc.data() });
      });

      if (loadedData.length > 0) {
        // order 필드 기준 정렬
        loadedData.sort((a, b) => a.order - b.order);
        localShortcutData = loadedData;
        // Default: Collapse all groups on mobile
        if (window.innerWidth <= 768) {
            localShortcutData.forEach(g => collapsedGroups.add(g.id));
        }
      } else {
        // 데이터가 없으면 초기 데이터(data.js)를 Firebase에 업로드
        localShortcutData = JSON.parse(JSON.stringify(shortcutData));
        // id 및 order 부여
        localShortcutData.forEach((group, index) => {
            if(!group.id) group.id = 'group-' + Date.now() + '-' + index;
            group.order = index;
            if(!group.items) group.items = [];
            group.items.forEach((item, i) => {
                if(!item.id) item.id = 'item-' + Date.now() + '-' + i;
            });
        });
        await saveAllShortcutsToFirebase();
      }
      renderShortcuts();
    } catch (err) {
      console.error("Firebase shortcuts load error:", err);
      // 에러 시 로컬 데이터 Fallback
      localShortcutData = JSON.parse(JSON.stringify(shortcutData));
      renderShortcuts();
    }
  }

  async function saveAllShortcutsToFirebase() {
      if (!window.db) return;
      const { db, firestoreUtils } = window;
      
      // 기존 데이터 삭제 로직은 복잡하므로, 덮어쓰기 방식으로 진행.
      // 실제로는 batch를 쓰는 게 좋지만 여기선 loop로 처리
      for (const group of localShortcutData) {
          await firestoreUtils.setDoc(firestoreUtils.doc(db, "shortcutGroups", group.id), group);
      }
  }
  
  async function deleteGroupFromFirebase(groupId) {
      if (!window.db) return;
      const { db, firestoreUtils } = window;
      await firestoreUtils.deleteDoc(firestoreUtils.doc(db, "shortcutGroups", groupId));
  }

  // 바로가기 렌더링 함수 (Sortable 적용)
  function renderShortcuts() {
    const isAdminRole = isAdmin();
    
    shortcutSection.innerHTML = `
      <div class="shortcut-controls">
        ${isEditMode 
          ? `<button id="add-group-btn" class="btn-secondary"><i class="fas fa-folder-plus"></i> 그룹 추가</button>
             <button id="save-order-btn" class="btn-success"><i class="fas fa-save"></i> 저장 완료</button>
             <button id="cancel-edit-btn" class="btn-cancel"><i class="fas fa-times"></i> 취소</button>`
          : (isAdminRole ? `<button id="edit-mode-btn" class="btn-primary mobile-hide"><i class="fas fa-edit"></i> 바로가기 편집</button>` : '')
        }
      </div>
      <div id="shortcut-container" class="shortcut-grid ${isEditMode ? 'edit-mode' : ''}"></div>
    `;
    
    const container = shortcutSection.querySelector("#shortcut-container");

    // 이벤트 리스너 다시 연결
    if(isEditMode) {
        document.getElementById('save-order-btn').addEventListener('click', async () => {
            isEditMode = false;
            await saveAllShortcutsToFirebase();
            renderShortcuts();
        });
        document.getElementById('cancel-edit-btn').addEventListener('click', () => {
            if(confirm('변경 사항을 저장하지 않고 편집을 종료하시겠습니까?')) {
                isEditMode = false;
                initShortcuts(); // 데이터 원복 (리로드)
            }
        });
        document.getElementById('add-group-btn').addEventListener('click', () => {
             openGroupModal();
        });
    } else {
        const editBtn = document.getElementById('edit-mode-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                isEditMode = true;
                renderShortcuts();
            });
        }
    }

    localShortcutData.forEach((group) => {
      const groupEl = document.createElement("div");
      groupEl.className = "shortcut-group";
      groupEl.dataset.id = group.id;

      let itemsHtml = "";
      if (group.items && group.items.length > 0) {
        itemsHtml = group.items.map(item => {
          // Check for custom icon
          let iconHtml = `<i class="fas ${item.icon}"></i>`;
          if (item.iconType === 'custom' || (item.icon && (item.icon.startsWith('http') || item.icon.startsWith('data:')))) {
              iconHtml = `<img src="${item.icon}" alt="icon" class="custom-icon-img">`;
          }

          return `
          <div class="shortcut-item" data-id="${item.id}" data-url="${item.url}" data-title="${item.title}" data-icon="${item.icon}" data-icon-type="${item.iconType || 'preset'}">
            ${isEditMode ? `
              <button class="delete-btn" onclick="deleteShortcut('${group.id}', '${item.id}')"><i class="fas fa-times"></i></button>
              <button class="edit-btn" onclick="editShortcut('${group.id}', '${item.id}')"><i class="fas fa-pencil-alt"></i></button>
            ` : ''}
            <a href="${isEditMode ? 'javascript:void(0)' : item.url}" target="${isEditMode ? '' : '_blank'}" class="shortcut-link-content">
                <div class="shortcut-icon">
                    ${iconHtml}
                </div>
                <span>${item.title}</span>
            </a>
          </div>
        `;
        }).join("");
      }

      const isCollapsed = collapsedGroups.has(group.id) && !isEditMode;

      groupEl.innerHTML = `
        ${isEditMode ? `
            <div class="group-actions">
                <button class="group-action-btn edit" onclick="editGroup('${group.id}')"><i class="fas fa-pencil-alt"></i></button>
                <button class="group-action-btn delete" onclick="deleteGroup('${group.id}')"><i class="fas fa-trash"></i></button>
            </div>
        ` : ''}
        <h3 class="group-header ${isCollapsed ? 'collapsed' : ''}" onclick="toggleGroupCollapse('${group.id}')">
            ${group.category}
            <i class="fas ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'} toggle-icon"></i>
        </h3>
        <div class="shortcut-items ${isCollapsed ? 'hidden' : ''}" id="group-items-${group.id}">
            ${itemsHtml}
        </div>
        ${isEditMode ? `<button class="add-item-btn" onclick="addShortcut('${group.id}')"><i class="fas fa-plus"></i> 바로가기 추가</button>` : ''}
      `;

      container.appendChild(groupEl);

      // Sortable 적용 (그룹 내 아이템 정렬)
      if (isEditMode) {
          Sortable.create(groupEl.querySelector('.shortcut-items'), {
              group: 'shared-items', // 그룹 간 이동 허용
              animation: 150,
              onEnd: function (evt) {
                  // 이동 후 데이터 업데이트 로직 필요
                  updateLocalDataFromDOM();
              }
          });
      }
    });

    // 그룹 순서 정렬
    if (isEditMode) {
        Sortable.create(container, {
            animation: 150,
            handle: 'h3', // 헤더를 잡고 이동
            onEnd: function (evt) {
                updateLocalDataFromDOM();
            }
        });
    }
  }
  
  // 그룹 접기 토글 함수
  window.toggleGroupCollapse = (groupId) => {
      // Disable collapse on desktop
      if (window.innerWidth > 768) return;

      if (isEditMode) return;
      if (collapsedGroups.has(groupId)) {
          collapsedGroups.delete(groupId);
      } else {
          collapsedGroups.add(groupId);
      }
      renderShortcuts();
  };

  // DOM 상태를 보고 localShortcutData 업데이트
  function updateLocalDataFromDOM() {
      const container = document.getElementById("shortcut-container");
      const newGroups = [];
      
      container.querySelectorAll('.shortcut-group').forEach((groupEl, gIndex) => {
          const groupId = groupEl.dataset.id;
          const category = groupEl.querySelector('h3').innerText;
          const items = [];
          
          groupEl.querySelectorAll('.shortcut-item').forEach((itemEl, iIndex) => {
             items.push({
                 id: itemEl.dataset.id,
                 title: itemEl.dataset.title,
                 url: itemEl.dataset.url,
                 icon: itemEl.dataset.icon
             });
          });
          
          newGroups.push({
              id: groupId,
              category: category,
              items: items,
              order: gIndex
          });
      });
      
      localShortcutData = newGroups;
  }

  // 전역 함수로 노출 (HTML onclick에서 접근 위해)
  window.deleteShortcut = (groupId, itemId) => {
      if(!confirm('정말 삭제하시겠습니까?')) return;
      const group = localShortcutData.find(g => g.id === groupId);
      if(group) {
          group.items = group.items.filter(i => i.id !== itemId);
          renderShortcuts();
      }
  };
  
  window.deleteGroup = async (groupId) => {
      if(!confirm('그룹과 내부 바로가기가 모두 삭제됩니다. 계속하시겠습니까?')) return;
      localShortcutData = localShortcutData.filter(g => g.id !== groupId);
      // Firebase에서도 삭제
      await deleteGroupFromFirebase(groupId); 
      renderShortcuts();
  };

  window.initShortcuts = initShortcuts; // 외부 노출

  // 모달 관련
  const shortcutModal = document.getElementById('shortcutModal');
  const groupModal = document.getElementById('groupModal');
  const shortcutForm = document.getElementById('shortcutForm');
  const groupForm = document.getElementById('groupForm');
  
  // 아이콘 선택기 및 탭
  const iconOptions = document.querySelectorAll('.icon-option');
  const iconTabs = document.querySelectorAll('.icon-tab');
  const iconContents = document.querySelectorAll('.icon-tab-content');
  
  // 상태 변수
  let selectedIcon = 'fa-link';
  let selectedIconType = 'preset'; // preset or custom
  let customIconData = ''; // URL or Base64

  // 탭 전환
  iconTabs.forEach(tab => {
      tab.addEventListener('click', () => {
          const target = tab.dataset.tab;
          
          iconTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          iconContents.forEach(c => c.classList.remove('active'));
          document.getElementById(`icon-tab-${target}`).classList.add('active');
          selectedIconType = target;
      });
  });

  // 아이콘 선택 이벤트
  iconOptions.forEach(opt => {
      opt.addEventListener('click', () => {
          iconOptions.forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          selectedIcon = opt.dataset.icon;
          // 자동으로 탭 전환은 하지 않음 (사용자 의도 존중)
      });
  });

  // 이미지 파일 업로드 (Base64 변환 & 용량 체크)
  const fileInput = document.getElementById('shortcut-image-file');
  const urlInput = document.getElementById('shortcut-image-url');
  const base64Input = document.getElementById('shortcut-image-base64');
  const previewDiv = document.getElementById('image-preview');
  const previewImg = previewDiv.querySelector('img');
  const clearImgBtn = document.getElementById('clear-image');
  const radioInputs = document.querySelectorAll('input[name="image-source"]');

  // 라디오 버튼 변경 시 입력 필드 제어
  radioInputs.forEach(radio => {
      radio.addEventListener('change', (e) => {
          if(e.target.value === 'url') {
              urlInput.disabled = false;
              fileInput.disabled = true;
              urlInput.focus();
          } else {
              urlInput.disabled = true;
              fileInput.disabled = false;
          }
      });
  });
  
  // 초기 상태 설정
  fileInput.disabled = true;

  fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 20480) { // 20KB Limit
          alert('이미지 크기가 너무 큽니다. (20KB 이하 권장)\n작은 아이콘 이미지를 사용해주세요.');
          fileInput.value = '';
          return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
          customIconData = event.target.result;
          base64Input.value = customIconData;
          previewImg.src = customIconData;
          previewDiv.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
  });

  urlInput.addEventListener('input', (e) => {
      customIconData = e.target.value;
      if(customIconData) {
          previewImg.src = customIconData;
          previewDiv.classList.remove('hidden');
      } else {
          previewDiv.classList.add('hidden');
      }
  });

  clearImgBtn.addEventListener('click', () => {
      fileInput.value = '';
      urlInput.value = '';
      base64Input.value = '';
      customIconData = '';
      previewDiv.classList.add('hidden');
  });

  window.addShortcut = (groupId) => {
      shortcutModal.classList.add('active');
      document.getElementById('shortcutModalTitle').textContent = '바로가기 추가';
      document.getElementById('shortcut-group-id').value = groupId;
      document.getElementById('shortcut-id').value = '';
      document.getElementById('shortcut-title').value = '';
      document.getElementById('shortcut-url').value = '';
      
      // Reset Icon State
      resetIconState();
  };
  
  window.editShortcut = (groupId, itemId) => {
      const group = localShortcutData.find(g => g.id === groupId);
      const item = group.items.find(i => i.id === itemId);
      
      shortcutModal.classList.add('active');
      document.getElementById('shortcutModalTitle').textContent = '바로가기 수정';
      document.getElementById('shortcut-group-id').value = groupId;
      document.getElementById('shortcut-id').value = itemId;
      document.getElementById('shortcut-title').value = item.title;
      document.getElementById('shortcut-url').value = item.url;
      
      // Restore Icon State
      resetIconState();
      
      if (item.iconType === 'custom' || (item.icon && (item.icon.startsWith('http') || item.icon.startsWith('data:')))) {
          // Custom Image
          selectedIconType = 'custom';
          customIconData = item.icon;
          
          // Switch Tab
          iconTabs[1].click(); 
          
          if(item.icon.startsWith('data:')) {
              // Base64
              radioInputs[1].checked = true;
              fileInput.disabled = false;
              urlInput.disabled = true;
              base64Input.value = item.icon;
          } else {
              // URL
              radioInputs[0].checked = true;
              fileInput.disabled = true;
              urlInput.disabled = false;
              urlInput.value = item.icon;
          }
          previewImg.src = item.icon;
          previewDiv.classList.remove('hidden');
          
      } else {
          // Preset Icon
          selectedIconType = 'preset';
          selectedIcon = item.icon || 'fa-link';
          iconTabs[0].click();
          
          iconOptions.forEach(o => {
              if(o.dataset.icon === selectedIcon) o.classList.add('selected');
              else o.classList.remove('selected');
          });
      }
  };

  function resetIconState() {
      // Default to preset tab
      iconTabs[0].click();
      
      // Clear custom inputs
      fileInput.value = '';
      urlInput.value = '';
      base64Input.value = '';
      customIconData = '';
      previewDiv.classList.add('hidden');
      
      // Default Icon
      selectedIcon = 'fa-link';
      iconOptions.forEach(o => o.classList.remove('selected'));
      document.querySelector('.icon-option[data-icon="fa-link"]').classList.add('selected');
      
      // Reset Radios
      radioInputs[0].checked = true;
      urlInput.disabled = false;
      fileInput.disabled = true;
  }

  window.openGroupModal = (groupId = null) => {
      groupModal.classList.add('active');
      if(groupId) {
          const group = localShortcutData.find(g => g.id === groupId);
          document.getElementById('groupModalTitle').textContent = '그룹 수정';
          document.getElementById('group-id').value = groupId;
          document.getElementById('group-title').value = group.category;
      } else {
          document.getElementById('groupModalTitle').textContent = '그룹 추가';
          document.getElementById('group-id').value = '';
          document.getElementById('group-title').value = '';
      }
  };
  
  window.editGroup = (groupId) => {
      openGroupModal(groupId);
  };

  // 모달 닫기
  document.querySelectorAll('.close-shortcut-modal').forEach(btn => 
      btn.addEventListener('click', () => shortcutModal.classList.remove('active')));
  document.querySelectorAll('.close-group-modal').forEach(btn => 
      btn.addEventListener('click', () => groupModal.classList.remove('active')));

  // 바로가기 저장
  shortcutForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const groupId = document.getElementById('shortcut-group-id').value;
      const itemId = document.getElementById('shortcut-id').value;
      const title = document.getElementById('shortcut-title').value;
      let url = document.getElementById('shortcut-url').value;
      
      if (!url.startsWith('http')) url = 'https://' + url;

      // Determine final icon
      let finalIcon = selectedIcon;
      let finalIconType = 'preset';
      
      if (selectedIconType === 'custom' && customIconData) {
          finalIcon = customIconData;
          finalIconType = 'custom';
      }

      const group = localShortcutData.find(g => g.id === groupId);
      if (itemId) {
          // 수정
          const item = group.items.find(i => i.id === itemId);
          item.title = title;
          item.url = url;
          item.icon = finalIcon;
          item.iconType = finalIconType;
      } else {
          // 추가
          group.items.push({
              id: 'item-' + Date.now(),
              title: title,
              url: url,
              icon: finalIcon,
              iconType: finalIconType
          });
      }
      shortcutModal.classList.remove('active');
      renderShortcuts();
  });

  // 그룹 저장
  groupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const groupId = document.getElementById('group-id').value;
      const title = document.getElementById('group-title').value;

      if (groupId) {
          const group = localShortcutData.find(g => g.id === groupId);
          group.category = title;
      } else {
          localShortcutData.push({
              id: 'group-' + Date.now(),
              category: title,
              items: [],
              order: localShortcutData.length
          });
      }
      groupModal.classList.remove('active');
      renderShortcuts();
  });

  // initShortcuts(); // 스크립트 로드 시 시작 (상단 64행에서 이미 호출됨)

  // ================= Status Section Editing Logic =================
  let isStatusEditMode = false;
  window.statusData = {}; 
  let statusData = window.statusData; // 내부에서도 사용 가능케 유지
  let activeTabId = null;
  let originalStatusData = null; // 취소용 원본 백업

  async function initStatusEditing() {
      const statusSection = document.getElementById('status-section');
      if (!statusSection) return;

      // 1. Firebase 데이터 로드 (이미 로드된 데이터가 있다면 스킵 가능하지만, 최신화 위해 매번 로드 권장)
      await loadStatusData();
      
      // 2. 초기 탭 설정
      if (!activeTabId && Object.keys(statusData).length > 0) {
          const sorted = Object.entries(statusData).sort((a,b) => (a[1].order||0) - (b[1].order||0));
          activeTabId = sorted[0][0];
      }
      
      renderStatusTabs();
      renderStatusContent();

      // 3. 컨트롤 바 생성
      if (!document.getElementById('status-controls-area')) {
          const controlsDiv = document.createElement('div');
          controlsDiv.className = 'status-controls';
          controlsDiv.id = 'status-controls-area';
          // Append TO status-header (next to tabs)
          const header = document.getElementById('status-header');
          if (header) header.appendChild(controlsDiv);
      }
      renderStatusControls();
  }

  function renderStatusControls() {
      const area = document.getElementById('status-controls-area');
      if (!area) return;

      const activeTab = statusData[activeTabId];
      const currentCols = activeTab ? (activeTab.columns || 1) : 1;

      if (isStatusEditMode) {
          area.innerHTML = `
              <div class="layout-selector">
                  <span>단 배열:</span>
                  <select onchange="updateStatusLayout(this.value)">
                      <option value="1" ${currentCols==1?'selected':''}>1단 (기본)</option>
                      <option value="2" ${currentCols==2?'selected':''}>2단</option>
                      <option value="3" ${currentCols==3?'selected':''}>3단</option>
                  </select>
              </div>
              <button id="add-tab-master-btn" class="btn-secondary"><i class="fas fa-plus-square"></i> 탭 추가</button>
              <button id="save-status-btn" class="btn-success"><i class="fas fa-save"></i> 저장 완료</button>
              <button id="cancel-status-btn" class="btn-cancel"><i class="fas fa-times"></i> 취소</button>
          `;
          document.getElementById('save-status-btn').onclick = () => toggleStatusEditMode(true);
          document.getElementById('cancel-status-btn').onclick = () => {
              if (confirm('변경사항을 취소하시겠습니까?')) {
                  window.statusData = statusData = JSON.parse(JSON.stringify(originalStatusData));
                  isStatusEditMode = false;
                  renderStatusTabs();
                  renderStatusContent();
                  renderStatusControls();
              }
          };
          document.getElementById('add-tab-master-btn').onclick = addNewTab;
      } else {
          const isAdmin = window.currentUserRole === 'admin' || window.currentUserRole === 'sub-admin';
          if (isAdmin) {
              area.innerHTML = `
                  <button id="edit-status-btn" class="btn-primary">
                      <i class="fas fa-edit"></i> 현황 편집
                  </button>
              `;
              document.getElementById('edit-status-btn').onclick = () => toggleStatusEditMode(false);
          } else {
              area.innerHTML = '';
          }
      }
  }

  // Handle live role updates to refresh all admin controls
  window.addEventListener('user-role-updated', () => {
      renderStatusControls();
      renderShortcuts();
      initAccountEditing();
  });

  window.updateStatusLayout = (val) => {
      if (statusData[activeTabId]) {
          statusData[activeTabId].columns = parseInt(val);
          renderStatusContent();
      }
  };

  async function loadStatusData() {
      if (!window.db) return;
      const { db, firestoreUtils } = window;
      try {
          const q = firestoreUtils.query(firestoreUtils.collection(db, "statusTabs"));
          const querySnapshot = await firestoreUtils.getDocs(q);
          let loadedData = {};
          querySnapshot.forEach(doc => {
              const data = doc.data();
              // JSON 문자열로 저장된 경우 파싱, 아니면 그대로 사용 (하위 호환)
              if (data.jsonContent) {
                  try {
                      loadedData[doc.id] = JSON.parse(data.jsonContent);
                  } catch (e) {
                      loadedData[doc.id] = data;
                  }
              } else {
                  loadedData[doc.id] = data;
              }
          });

          if (Object.keys(loadedData).length === 0) {
              statusData = {
                  "staff": { 
                      title: "교직원 현황", order: 0, columns: 2, 
                      tables: [
                          { headers: ["번호", "직", "성명", "담당", "근무장소", "내선번호"], widths: [40, 60, 80, 150, 100, 80], rows: Array.from({length: 10}, () => ["", "", "", "", "", ""]) },
                          { headers: ["번호", "직", "성명", "담당", "근무장소", "내선번호"], widths: [40, 60, 80, 150, 100, 80], rows: Array.from({length: 10}, () => ["", "", "", "", "", ""]) }
                      ] 
                  },
                  "afterschool": { 
                      title: "돌봄, 방과후 강사 현황", order: 1, columns: 1, 
                      tables: [
                          { headers: ["번호", "강좌명", "성명", "수업장소", "요일", "교시", "대상", "비고"], widths: [40, 120, 80, 100, 60, 60, 100, 100], rows: Array.from({length: 10}, () => ["", "", "", "", "", "", "", ""]) }
                      ] 
                  },
                  "students": { 
                      title: "학생 현황", order: 2, columns: 2,
                      tables: [
                          { headers: ["학년", "반", "성명", "성별", "비고"], widths: [50, 50, 80, 60, 120], rows: Array.from({length: 10}, () => ["", "", "", "", ""]) },
                          { headers: ["학년", "반", "성명", "성별", "비고"], widths: [50, 50, 80, 60, 120], rows: Array.from({length: 10}, () => ["", "", "", "", ""]) }
                      ] 
                  },
                  "approval": { 
                      title: "주요 결재경로", order: 3, columns: 1, 
                      tables: [
                          { headers: ["구분", "담당", "교무부장", "행정실장", "교장"], widths: [80, 80, 100, 100, 100], rows: Array.from({length: 8}, () => ["", "", "", "", ""]) }
                      ] 
                  }
              };
              window.statusData = statusData;
              await saveStatusDataToFirebase(true); // 초기 데이터 생성 시에는 무음으로 저장 시도
          } else {
              statusData = loadedData;
              window.statusData = statusData;
          }
      } catch (e) {
          console.error("Status load error", e);
      }
  }

  async function saveStatusDataToFirebase(silent = false) {
      if (!window.db) return;
      const { db, firestoreUtils } = window;
      
      try {
          // 0. 저장 전 최신 DOM 데이터 동기화
          syncStatusDataFromDOM();

          // 1. 현재 존재하는 탭들을 저장
          for (const [id, data] of Object.entries(statusData)) {
              if (!data || typeof data !== 'object') continue;
              
              // Firestore는 중첩 배열(Array of Arrays)을 지원하지 않으므로 JSON 문자열로 변환하여 저장
              const jsonContent = JSON.stringify(data);
              await firestoreUtils.setDoc(firestoreUtils.doc(db, "statusTabs", id), {
                  jsonContent: jsonContent,
                  updatedAt: new Date().toISOString()
              });
          }
          
          // 2. 삭제된 탭 처리
          const q = firestoreUtils.query(firestoreUtils.collection(db, "statusTabs"));
          const querySnapshot = await firestoreUtils.getDocs(q);
          const deletePromises = [];
          querySnapshot.forEach(docSnap => {
              if (!statusData[docSnap.id]) {
                  deletePromises.push(firestoreUtils.deleteDoc(firestoreUtils.doc(db, "statusTabs", docSnap.id)));
              }
          });
          if (deletePromises.length > 0) {
              await Promise.all(deletePromises);
          }
          
      } catch (e) {
          console.error("Status save error details:", e);
          if (!silent) {
              const errorMsg = e.code ? `[${e.code}] ${e.message}` : e.message;
              alert(`데이터 저장 중 오류가 발생했습니다.\n상세내용: ${errorMsg}`);
          }
      }
  }

  // 현재 활성화된 탭의 입력을 statusData 객체에 동기화
  function syncStatusDataFromDOM() {
      if (!activeTabId || !statusData[activeTabId]) return;
      
      const tableEls = document.querySelectorAll('.status-table');
      tableEls.forEach(table => {
          const tIdx = parseInt(table.dataset.tid);
          if (isNaN(tIdx)) return;
          
          const tabTableData = statusData[activeTabId].tables[tIdx];
          if (!tabTableData) return;
          
          // Headers sync
          const headerInputs = table.querySelectorAll('thead .editable-input');
          if (headerInputs.length > 0) {
              headerInputs.forEach((input, hIdx) => {
                  tabTableData.headers[hIdx] = input.value || "";
              });
          }
          
          // Rows sync
          const rows = table.querySelectorAll('tbody tr');
          rows.forEach((tr, rIdx) => {
              const inputs = tr.querySelectorAll('.editable-input');
              if (!tabTableData.rows[rIdx]) {
                  tabTableData.rows[rIdx] = Array(tabTableData.headers.length).fill("");
              }
              inputs.forEach((input, cIdx) => {
                  tabTableData.rows[rIdx][cIdx] = input.value || "";
              });
          });

          // Column widths sync (New)
          const ths = table.querySelectorAll('thead th');
          if (ths.length > 0) {
              const newWidths = [];
              ths.forEach(th => {
                  // offsetWidth includes padding and border
                  newWidths.push(th.offsetWidth);
              });
              tabTableData.widths = newWidths;
          }
      });
  }

  async function toggleStatusEditMode(save = false) {
      const btn = document.getElementById('save-status-btn');
      if (!isStatusEditMode) {
          // 편집 시작: 데이터 백업
          originalStatusData = JSON.parse(JSON.stringify(statusData));
          isStatusEditMode = true;
      } else if (save) {
          // 저장
          if (btn) {
              btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 중...';
              btn.disabled = true;
          }
          
          await saveStatusDataToFirebase();
          isStatusEditMode = false;
          
          if (btn) {
              btn.innerHTML = '<i class="fas fa-save"></i> 저장 완료';
              btn.disabled = false;
          }
      }
      renderStatusTabs();
      renderStatusContent();
      renderStatusControls();
  }

  function renderStatusTabs() {
      const container = document.getElementById('status-tabs-container');
      if (!container) return;
      container.innerHTML = '';
      container.className = isStatusEditMode ? 'status-tabs edit-mode' : 'status-tabs';

      const sorted = Object.entries(statusData).sort((a,b) => (a[1].order||0) - (b[1].order||0));
      
      sorted.forEach(([id, tab]) => {
          const btn = document.createElement('button');
          btn.className = id === activeTabId ? 'status-tab active' : 'status-tab';
          btn.innerHTML = isStatusEditMode 
              ? `${tab.title} <span class="delete-tab-btn" onclick="removeTab('${id}')"><i class="fas fa-times"></i></span>`
              : tab.title;

          btn.onclick = (e) => {
              if (e.target.closest('.delete-tab-btn')) return;
              activeTabId = id;
              renderStatusTabs();
              renderStatusContent();
          };
          container.appendChild(btn);
      });

      if (isStatusEditMode) {
          new Sortable(container, {
              animation: 150,
              filter: '.delete-tab-btn',
              onEnd: () => {
                  const items = container.querySelectorAll('.status-tab');
                  items.forEach((item, index) => {
                      // 탭 텍스트 기반으로 ID 찾기 (실제로는 더 안정적인 방법 필요)
                      // 여기서는 dataset 활용
                      const tabName = item.textContent.trim();
                      const entry = Object.entries(statusData).find(e => e[1].title === tabName);
                      if (entry) statusData[entry[0]].order = index;
                  });
              }
          });
      }
  }

  function renderStatusContent() {
      const container = document.getElementById('status-panels-container');
      if (!container) return;
      container.innerHTML = '';

      if (!activeTabId || !statusData[activeTabId]) return;

      const tabData = statusData[activeTabId];
      const panel = document.createElement('div');
      panel.className = 'status-panel active';

      const gridCols = tabData.columns || 1;
      let html = `<div class="table-container"><div class="table-grid-wrapper table-grid-${gridCols}">`;
      
      tabData.tables.forEach((table, tIdx) => {
          html += `<div class="editable-table-wrapper" style="margin-bottom:2rem; width:100%;">
                    <table class="status-table ${isStatusEditMode ? 'editable-table' : ''}" data-tid="${tIdx}" style="width:100%;">
                      <thead><tr>`;
          table.headers.forEach((h, hIndex) => {
              const w = table.widths && table.widths[hIndex] ? table.widths[hIndex] + 'px' : 'auto';
              html += `<th data-col="${hIndex}" style="width: ${w}">
                          <div class="header-inner">
                            ${isStatusEditMode ? `<input class="editable-input" value="${h}" onchange="statusData['${activeTabId}'].tables[${tIdx}].headers[${hIndex}]=this.value">` : h}
                          </div>
                       </th>`;
          });
          html += `</tr></thead><tbody>`;
          table.rows.forEach((row, rIdx) => {
              html += `<tr>`;
              row.forEach((cell, cIndex) => {
                  html += `<td>${isStatusEditMode ? `<input class="editable-input" value="${cell}" onchange="statusData['${activeTabId}'].tables[${tIdx}].rows[${rIdx}][${cIndex}]=this.value">` : cell}</td>`;
              });
              html += `</tr>`;
          });
          html += `</tbody></table>`;
          
          if (isStatusEditMode) {
              html += `<div class="table-controls">
                <button class="btn-mini" onclick="statusRowAction('${activeTabId}', ${tIdx}, 'add')"><i class="fas fa-plus"></i> 행 추가</button>
                <button class="btn-mini danger" onclick="statusRowAction('${activeTabId}', ${tIdx}, 'remove')"><i class="fas fa-minus"></i> 행 삭제</button>
                <button class="btn-mini" onclick="statusColAction('${activeTabId}', ${tIdx}, 'add')"><i class="fas fa-plus"></i> 열 추가</button>
                <button class="btn-mini danger" onclick="statusColAction('${activeTabId}', ${tIdx}, 'remove')"><i class="fas fa-minus"></i> 열 삭제</button>
                <button class="btn-mini danger" onclick="removeTableFromTab('${activeTabId}', ${tIdx})">표 삭제</button>
              </div>`;
          }
          html += `</div>`;
      });
      html += `</div></div>`;
      
      if (isStatusEditMode) {
          html += `<div class="add-table-container"><button class="add-tab-btn" onclick="addTableToTab('${activeTabId}')"><i class="fas fa-table"></i> 표 추가하기</button></div>`;
      }

      panel.innerHTML = html;
      container.appendChild(panel);
      if (isStatusEditMode && window.initTableResizing) {
          window.initTableResizing((table, colIdx, newWidth) => {
              const tIdx = table.dataset.tid;
              if (activeTabId && statusData[activeTabId] && statusData[activeTabId].tables[tIdx]) {
                  const tableData = statusData[activeTabId].tables[tIdx];
                  if (!tableData.widths) tableData.widths = Array(tableData.headers.length).fill(100);
                  tableData.widths[colIdx] = newWidth;
              }
          });
      }
  }

  // Actions
  window.removeTab = (id) => {
      if (confirm('이 탭을 삭제하시겠습니까?')) {
          delete statusData[id];
          if (activeTabId === id) activeTabId = Object.keys(statusData)[0] || null;
          renderStatusTabs();
          renderStatusContent();
      }
  };

  function addNewTab() {
      const title = prompt('새 탭 이름:');
      if (title) {
          const id = 'tab_' + Date.now();
          statusData[id] = { title, order: Object.keys(statusData).length, columns: 1, tables: [{ headers: ['제목1'], widths:[100], rows: [['']] }] };
          activeTabId = id;
          renderStatusTabs();
          renderStatusContent();
          renderStatusControls();
      }
  }

  window.addTableToTab = (tabId) => {
      statusData[tabId].tables.push({ headers: ['제목1'], widths: [100], rows: [['']] });
      renderStatusContent();
  };

  window.removeTableFromTab = (tabId, tIdx) => {
      if (confirm('이 표를 삭제하시겠습니까?')) {
          statusData[tabId].tables.splice(tIdx, 1);
          renderStatusContent();
      }
  };

  window.statusRowAction = (tabId, tIdx, type) => {
      const table = statusData[tabId].tables[tIdx];
      if (type === 'add') table.rows.push(Array(table.headers.length).fill(''));
      else if (table.rows.length > 0) table.rows.pop();
      renderStatusContent();
  };

  window.statusColAction = (tabId, tIdx, type) => {
      const table = statusData[tabId].tables[tIdx];
      if (type === 'add') {
          table.headers.push('새 열');
          if (!table.widths) table.widths = Array(table.headers.length - 1).fill(100);
          table.widths.push(100);
          table.rows.forEach(r => r.push(''));
      } else if (table.headers.length > 0) {
          table.headers.pop();
          if (table.widths) table.widths.pop();
          table.rows.forEach(r => r.pop());
      }
      renderStatusContent();
  };

  window.addEventListener('firebase-ready', initStatusEditing);
  if (window.db) initStatusEditing();


  // ================= 자료마당 (Datayard) Logic =================
  
  // 초기화 및 Firebase 데이터 로드
  async function initDatayard() {
    if (!window.db) {
      window.addEventListener('firebase-ready', () => loadDatayardFromFirebase());
      // fallback
      localDatayardData = JSON.parse(JSON.stringify(datayardData));
      renderDatayard();
    } else {
      await loadDatayardFromFirebase();
    }
  }

  async function loadDatayardFromFirebase() {
    const { db, firestoreUtils } = window;
    try {
      const querySnapshot = await firestoreUtils.getDocs(firestoreUtils.collection(db, "datayardGroups"));
      let groups = [];
      querySnapshot.forEach(doc => {
        groups.push({ id: doc.id, ...doc.data() });
      });
      
      if (groups.length === 0) {
        // 초대 데이터가 없으면 data.js에서 초기 데이터 로드 및 저장
        for (let i = 0; i < datayardData.length; i++) {
          const group = { ...datayardData[i], order: i };
          const docId = `group-${Date.now()}-${i}`;
          await firestoreUtils.setDoc(firestoreUtils.doc(db, "datayardGroups", docId), group);
          groups.push({ id: docId, ...group });
        }
      }
      
      groups.sort((a, b) => (a.order || 0) - (b.order || 0));
      localDatayardData = groups;
      renderDatayard();
    } catch (error) {
      console.error("Error loading datayard:", error);
      localDatayardData = JSON.parse(JSON.stringify(datayardData));
      renderDatayard();
    }
  }

  async function saveDatayardToFirebase() {
    const { db, firestoreUtils } = window;
    try {
      for (const group of localDatayardData) {
        await firestoreUtils.setDoc(firestoreUtils.doc(db, "datayardGroups", group.id), group);
      }
      alert("자료마당 변경사항이 저장되었습니다.");
    } catch (error) {
      console.error("Error saving datayard:", error);
      alert("저장 중 오류가 발생했습니다.");
    }
  }

  function renderDatayard() {
    const container = document.getElementById("datayard-container");
    if(!container) return;

    container.innerHTML = "";
    
    // Header (제목)는 datayardSection의 첫 부분에 이미 HTML로 들어가 있음.
    // 하지만 renderDatayard가 호출될 때마다 section 전체가 아닌 container만 갱신.

    localDatayardData.forEach((group, groupIndex) => {
      const card = document.createElement("div");
      card.className = "helppage-card-container datayard-group-card";
      card.dataset.id = group.id;

      card.innerHTML = `
        <div class="helppage-main-card">
          <div class="helppage-main-toggle" style="cursor: ${datayardEditMode ? 'default' : 'pointer'}">
            <div class="header-info">
              ${datayardEditMode ? '<i class="fas fa-grip-vertical datayard-sortable-handle group-handle"></i>' : ''}
              <div class="icon-box ${group.color || 'blue'}-bg">
                <i class="fas ${group.icon || 'fa-folder'} ${group.color || 'blue'}-text"></i>
              </div>
              <div class="title-group">
                <h3>${group.category}</h3>
                <p>${group.category} 관련 자료 목록</p>
              </div>
              ${datayardEditMode ? `
                <div class="group-edit-actions">
                  <button class="edit-btn edit-group-btn" title="그룹 수정"><i class="fas fa-pen"></i></button>
                  <button class="delete-btn delete-group-btn" title="그룹 삭제"><i class="fas fa-trash"></i></button>
                </div>
              ` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
               ${datayardEditMode ? `
                  <button class="add-item-btn add-file-btn" title="자료 추가"><i class="fas fa-plus-circle"></i> 자료추가</button>
               ` : ''}
               <i class="fas fa-chevron-down main-chevron"></i>
            </div>
          </div>
          
          <div id="${group.id}-content" class="hidden-content ${datayardEditMode ? '' : 'hidden'}">
            <div class="sub-sections-container">
              <div class="sub-items-list datayard-items-container" style="padding-left: 0;" data-group-id="${group.id}">
                ${group.items.map((item, itemIndex) => `
                  <div class="file-item-wrapper" data-index="${itemIndex}">
                    <a href="${item.url}" class="file-item" onclick="window.forceDownload(event, '${item.url}', '${item.title}')">
                      ${datayardEditMode ? '<i class="fas fa-grip-vertical datayard-sortable-handle item-handle"></i>' : ''}
                      <i class="fas fa-file-alt"></i>
                      <span>${item.title}</span>
                      <i class="fas fa-download link-icon" style="font-size: 0.85rem; opacity: 0.7;"></i>
                    </a>
                    ${datayardEditMode ? `
                      <div class="item-edit-actions">
                        <button class="edit-btn edit-item-btn" title="자료 수정"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn delete-item-btn" title="자료 삭제"><i class="fas fa-times"></i></button>
                      </div>
                    ` : ''}
                  </div>
                `).join("")}
                ${group.items.length === 0 ? '<p class="no-results">등록된 자료가 없습니다.</p>' : ''}
              </div>
            </div>
          </div>
        </div>
      `;

      // 토글 이벤트
      const toggleArea = card.querySelector(".helppage-main-toggle");
      const content = card.querySelector(".hidden-content");
      const chevron = card.querySelector(".main-chevron");

      toggleArea.addEventListener("click", (e) => {
        // 버튼 클릭 시 토글 방지
        if (e.target.closest('button') || e.target.closest('.datayard-sortable-handle')) return;
        
        const isHidden = content.classList.contains("hidden");
        if (isHidden) {
          content.classList.remove("hidden");
          chevron.style.transform = "rotate(180deg)";
        } else {
          content.classList.add("hidden");
          chevron.style.transform = "rotate(0deg)";
        }
      });

      // 그룹 수정/삭제 이벤트
      if (datayardEditMode) {
        // 제목(텍스트 영역) 클릭 시에도 편집 모달 열기
        card.querySelector(".title-group").style.cursor = "pointer";
        card.querySelector(".title-group").addEventListener("click", (e) => {
          e.stopPropagation();
          openDatayardGroupModal(group);
        });

        card.querySelector(".edit-group-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          openDatayardGroupModal(group);
        });

        card.querySelector(".delete-group-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          deleteDatayardGroup(group.id);
        });

        card.querySelector(".add-file-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          openDatayardItemModal(group.id);
        });

        // 아이템별 수정/삭제
        card.querySelectorAll(".file-item-wrapper").forEach(wrapper => {
          const itemIdx = wrapper.dataset.index;
          wrapper.querySelector(".edit-item-btn").addEventListener("click", (e) => {
            e.preventDefault();
            openDatayardItemModal(group.id, itemIdx);
          });
          wrapper.querySelector(".delete-item-btn").addEventListener("click", (e) => {
            e.preventDefault();
            deleteDatayardItem(group.id, itemIdx);
          });
        });

        // Item Sortable
        new Sortable(card.querySelector(".datayard-items-container"), {
          handle: '.item-handle',
          animation: 150,
          ghostClass: 'sortable-ghost',
          onEnd: function() {
            updateDatayardOrderFromDOM();
          }
        });
      }

      container.appendChild(card);
    });

    // Group Sortable
    if (datayardEditMode) {
      new Sortable(container, {
        handle: '.group-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function() {
          updateDatayardOrderFromDOM();
        }
      });
    }
  }

  function updateDatayardOrderFromDOM() {
    const container = document.getElementById("datayard-container");
    const newGroups = [];
    
    container.querySelectorAll(".datayard-group-card").forEach((groupEl, gIndex) => {
      const groupId = groupEl.dataset.id;
      const originalGroup = localDatayardData.find(g => g.id === groupId);
      if(!originalGroup) return;

      const newItems = [];
      groupEl.querySelectorAll(".file-item-wrapper").forEach((itemEl) => {
        const itemIdx = itemEl.dataset.index;
        newItems.push(originalGroup.items[itemIdx]);
      });

      newGroups.push({
        ...originalGroup,
        order: gIndex,
        items: newItems
      });
    });
    
    localDatayardData = newGroups;
  }

  // 모달 관련
  const dyGroupModal = document.getElementById('datayardGroupModal');
  const dyItemModal = document.getElementById('datayardItemModal');
  const dyGroupForm = document.getElementById('datayardGroupForm');
  const dyItemForm = document.getElementById('datayardItemForm');

  function openDatayardGroupModal(group = null) {
    dyGroupModal.classList.add('active');
    dyGroupForm.reset();
    
    const iconInput = document.getElementById('datayard-group-icon');
    const iconOptions = document.querySelectorAll('#datayard-group-icon-selector .icon-option');
    
    if(group) {
      document.getElementById('datayardGroupModalTitle').textContent = "그룹 수정";
      document.getElementById('datayard-group-id').value = group.id;
      document.getElementById('datayard-group-title').value = group.category;
      const currentIcon = group.icon || 'fa-folder';
      iconInput.value = currentIcon;
      document.getElementById('datayard-group-color').value = group.color || 'blue';
      
      // 아이콘 선택 상태 반영
      iconOptions.forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.icon === currentIcon);
      });
    } else {
      document.getElementById('datayardGroupModalTitle').textContent = "그룹 추가";
      document.getElementById('datayard-group-id').value = "";
      iconInput.value = 'fa-folder';
      iconOptions.forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.icon === 'fa-folder');
      });
    }
  }

  // 자료마당 그룹 아이콘 선택 이벤트
  document.querySelectorAll('#datayard-group-icon-selector .icon-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('#datayard-group-icon-selector .icon-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      document.getElementById('datayard-group-icon').value = opt.dataset.icon;
    });
  });

  function openDatayardItemModal(groupId, itemIdx = null) {
    dyItemModal.classList.add('active');
    dyItemForm.reset();
    datayardFileToUpload = null;
    document.getElementById('datayard-file-preview').classList.add('hidden');
    document.getElementById('datayard-upload-progress').classList.add('hidden');
    
    document.getElementById('datayard-item-group-id').value = groupId;
    
    if(itemIdx !== null) {
      const group = localDatayardData.find(g => g.id === groupId);
      const item = group.items[itemIdx];
      document.getElementById('datayardItemModalTitle').textContent = "자료 수정";
      document.getElementById('datayard-item-id').value = itemIdx;
      document.getElementById('datayard-item-title').value = item.title;
      document.getElementById('datayard-item-url').value = item.url;
      document.getElementById('datayard-item-url-input').value = item.url;
      
      // 파일인지 URL인지 대략적으로 판단하여 탭 활성화 (Firebase Storage URL 체크)
      const isFirebaseUrl = item.url.includes('firebasestorage') || item.url.includes('mybox'); // Assuming logic
      if(isFirebaseUrl) {
         switchDyItemTab('upload');
         // 기존 파일이 있다는 표시
         document.getElementById('datayard-file-name-display').textContent = "기존 파일 유지 (변경하려면 파일 선택)";
         document.getElementById('datayard-file-preview').classList.remove('hidden');
      } else {
         switchDyItemTab('url');
      }
    } else {
      document.getElementById('datayardItemModalTitle').textContent = "자료 추가";
      document.getElementById('datayard-item-id').value = "";
      document.getElementById('datayard-item-url').value = "";
      switchDyItemTab('upload');
    }
  }

  function deleteDatayardGroup(groupId) {
    if(confirm("이 그룹과 포함된 모든 자료를 삭제하시겠습니까?")) {
      const index = localDatayardData.findIndex(g => g.id === groupId);
      if(index > -1) {
        localDatayardData.splice(index, 1);
        // Firebase 삭제
        if(window.db) {
          const { db, firestoreUtils } = window;
          firestoreUtils.deleteDoc(firestoreUtils.doc(db, "datayardGroups", groupId));
        }
        renderDatayard();
      }
    }
  }

  function deleteDatayardItem(groupId, itemIdx) {
    if(confirm("이 자료를 삭제하시겠습니까?")) {
      const group = localDatayardData.find(g => g.id === groupId);
      if(group) {
        group.items.splice(itemIdx, 1);
        renderDatayard();
      }
    }
  }

  function switchDyItemTab(tab) {
    datayardActiveTab = tab;
    document.querySelectorAll('.item-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('.item-tab-content').forEach(c => {
      c.classList.toggle('active', c.id === `item-tab-${tab}`);
    });
  }

  // 모달 이벤트 리스너
  document.querySelectorAll('.close-datayard-group-modal').forEach(btn => btn.addEventListener('click', () => dyGroupModal.classList.remove('active')));
  document.querySelectorAll('.close-datayard-item-modal').forEach(btn => btn.addEventListener('click', () => dyItemModal.classList.remove('active')));
  
  document.querySelectorAll('.item-tab').forEach(tab => {
    tab.addEventListener('click', () => switchDyItemTab(tab.dataset.tab));
  });

  // 파일 업로드 처리
  const dyFileInput = document.getElementById('datayard-file-input');
  const dyFileDropZone = document.getElementById('datayard-file-drop-zone');
  
  dyFileDropZone.addEventListener('click', () => dyFileInput.click());
  dyFileInput.addEventListener('change', (e) => handleDyFile(e.target.files[0]));
  
  dyFileDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dyFileDropZone.classList.add('drag-over');
  });
  dyFileDropZone.addEventListener('dragleave', () => dyFileDropZone.classList.remove('drag-over'));
  dyFileDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dyFileDropZone.classList.remove('drag-over');
    handleDyFile(e.dataTransfer.files[0]);
  });

  function handleDyFile(file) {
    if(!file) return;
    datayardFileToUpload = file;
    document.getElementById('datayard-file-name-display').textContent = file.name;
    document.getElementById('datayard-file-preview').classList.remove('hidden');
    // 자동 제목 입력 (비어있을 경우)
    const titleInput = document.getElementById('datayard-item-title');
    if(!titleInput.value) {
      titleInput.value = file.name.split('.').slice(0, -1).join('.');
    }
  }

  document.getElementById('datayard-remove-file-btn').addEventListener('click', () => {
    datayardFileToUpload = null;
    document.getElementById('datayard-file-preview').classList.add('hidden');
    dyFileInput.value = '';
  });

  // 그룹 저장
  dyGroupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('datayard-group-id').value;
    const title = document.getElementById('datayard-group-title').value;
    const icon = document.getElementById('datayard-group-icon').value;
    const color = document.getElementById('datayard-group-color').value;

    if(id) {
      // 수정
      const group = localDatayardData.find(g => g.id === id);
      group.category = title;
      group.icon = icon;
      group.color = color;
    } else {
      // 추가
      const newId = `group-${Date.now()}`;
      localDatayardData.push({
        id: newId,
        category: title,
        icon: icon,
        color: color,
        items: [],
        order: localDatayardData.length
      });
    }
    dyGroupModal.classList.remove('active');
    renderDatayard();
  });

  // 아이템 저장
  dyItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const groupId = document.getElementById('datayard-item-group-id').value;
    const itemId = document.getElementById('datayard-item-id').value;
    const title = document.getElementById('datayard-item-title').value;
    let url = document.getElementById('datayard-item-url-input').value;

    const group = localDatayardData.find(g => g.id === groupId);

    // 파일 업로드 모드인 경우
    if (datayardActiveTab === 'upload' && datayardFileToUpload) {
      const { storage, storageUtils } = window;
      if(!storage) {
        alert("Firebase Storage가 준비되지 않았습니다.");
        return;
      }
      
      const progressArea = document.getElementById('datayard-upload-progress');
      const progressFill = progressArea.querySelector('.progress-fill');
      const progressText = progressArea.querySelector('.progress-text');
      
      progressArea.classList.remove('hidden');
      
      try {
        const fileRef = storageUtils.ref(storage, `datayard/${Date.now()}_${datayardFileToUpload.name}`);
        // uploadBytes doesn't provide progress easily without uploadBytesResumable, 
        // but let's keep it simple or use a placeholder progress
        progressFill.style.width = "50%";
        progressText.textContent = "업로드 중... (50%)";
        
        const snapshot = await storageUtils.uploadBytes(fileRef, datayardFileToUpload);
        url = await storageUtils.getDownloadURL(snapshot.ref);
        
        progressFill.style.width = "100%";
        progressText.textContent = "업로드 완료! (100%)";
      } catch (err) {
        console.error("Upload error:", err);
        alert("파일 업로드 중 오류가 발생했습니다.");
        return;
      }
    } else if (datayardActiveTab === 'upload' && itemId !== "") {
       // 수정 모드인데 파일을 새로 선택 안 했으면 기존 URL 유지
       url = document.getElementById('datayard-item-url').value;
    }

    if(itemId !== "") {
      // 수정
      group.items[itemId] = { title, url };
    } else {
      // 추가
      group.items.push({ title, url });
    }

    dyItemModal.classList.remove('active');
    renderDatayard();
  });

  // 자료마당 편집 모드 토글
  const dyEditBtn = document.getElementById('datayard-edit-mode-btn');
  const dyEditActions = document.getElementById('datayard-edit-actions');
  const dyAddGroupBtn = document.getElementById('datayard-add-group-btn');
  const dySaveOrderBtn = document.getElementById('datayard-save-order-btn');
  const dyCancelEditBtn = document.getElementById('datayard-cancel-edit-btn'); // New Cancel Button

  let datayardBackup = null;

  if (dyEditBtn) {
    dyEditBtn.addEventListener('click', () => {
      datayardEditMode = true;
      datayardBackup = JSON.parse(JSON.stringify(localDatayardData)); // Backup data
      dyEditBtn.classList.add('hidden');
      dyEditActions.classList.remove('hidden');
      renderDatayard();
    });
  }

  dyAddGroupBtn.addEventListener('click', () => openDatayardGroupModal());

  dySaveOrderBtn.addEventListener('click', async () => {
    datayardEditMode = false;
    dyEditActions.classList.add('hidden');
    await saveDatayardToFirebase();
    renderDatayard();
  });

  dyCancelEditBtn.addEventListener('click', () => {
    if(confirm("저장하지 않은 변경사항은 사라집니다. 편집을 취소하시겠습니까?")) {
      datayardEditMode = false;
      if (datayardBackup) {
        localDatayardData = JSON.parse(JSON.stringify(datayardBackup));
      }
      dyEditActions.classList.add('hidden');
      renderDatayard();
    }
  });

  window.initDatayard = initDatayard;

  // 온학교 e지원 렌더링 함수 (원본 사이트 구조 1:1 재현)
  function renderHelppage() {
    helppageSection.innerHTML = `
      <div class="helppage-header">
        <h2>경상남도교육청 학교업무 도움자료</h2>
        <p>학교 업무에 필요한 자료를 쉽게 찾아보세요!</p>
      </div>
      <div class="helppage-grid"></div>
      <div class="helppage-footer">
        <p>출처: 경남교육청 온학교 e지원(<a href="https://hryoon0.github.io/helppage/" target="_blank">https://hryoon0.github.io/helppage/</a>)</p>
      </div>
    `;
    const grid = helppageSection.querySelector(".helppage-grid");

    helppageConfig.forEach((config) => {
      const card = document.createElement("div");
      card.className = `helppage-card-container`;
      
      card.innerHTML = `
        <div class="helppage-main-card">
          <button class="helppage-main-toggle" data-id="${config.id}">
            <div class="header-info">
              <div class="icon-box ${config.color}-bg">
                <i class="fas ${config.icon} ${config.color}-text"></i>
              </div>
              <div class="title-group">
                <h3>${config.title}</h3>
                <p>${config.desc}</p>
              </div>
            </div>
            <i class="fas fa-chevron-down main-chevron"></i>
          </button>
          
          <div id="${config.id}-content" class="hidden-content hidden">
            <div class="search-wrapper">
              <div class="relative-search">
                <input type="text" placeholder="원하는 업무를 검색해 보세요." class="category-search-input" data-id="${config.id}">
                <i class="fas fa-search search-icon"></i>
              </div>
            </div>
            <div id="${config.id}-sections" class="sub-sections-container">
              <!-- 하위 섹션들이 검색에 따라 렌더링됨 -->
            </div>
          </div>
        </div>
      `;

      // 1단계 토글 이벤트
      const toggleBtn = card.querySelector(".helppage-main-toggle");
      const content = card.querySelector(".hidden-content");
      const chevron = card.querySelector(".main-chevron");

      toggleBtn.addEventListener("click", () => {
        const isHidden = content.classList.contains("hidden");
        if (isHidden) {
          content.classList.remove("hidden");
          chevron.style.transform = "rotate(180deg)";
          renderHelppageSubSections(config.id);
        } else {
          content.classList.add("hidden");
          chevron.style.transform = "rotate(0deg)";
        }
      });

      // 검색 이벤트
      const searchInput = card.querySelector(".category-search-input");
      searchInput.addEventListener("input", (e) => {
        searchHelppageItems(config.id, e.target.value.toLowerCase());
      });

      grid.appendChild(card);
    });
  }

  // 하위 섹션 렌더링 함수
  function renderHelppageSubSections(categoryId, searchTerm = "") {
    const config = helppageConfig.find(c => c.id === categoryId);
    const container = document.getElementById(`${categoryId}-sections`);
    const data = config.data;

    container.innerHTML = "";

    Object.entries(data).forEach(([sectionTitle, sectionData]) => {
      // 검색어 필터링
      const matchingItems = sectionData.items.filter(item => 
        item.title.toLowerCase().includes(searchTerm) || 
        sectionTitle.toLowerCase().includes(searchTerm)
      );

      if (searchTerm && matchingItems.length === 0 && !sectionTitle.toLowerCase().includes(searchTerm)) {
        return;
      }

      const sectionEl = document.createElement("div");
      sectionEl.className = "sub-section-item";
      
      const subId = `${categoryId}-${sectionTitle.replace(/\s+/g, '-')}`;
      const isAutoOpen = searchTerm.length > 0;

      sectionEl.innerHTML = `
        <button class="sub-section-toggle" data-target="${subId}">
          <div class="sub-header-left">
            <div class="sub-icon-box ${sectionData.color}-100-bg">
              <i class="${sectionData.icon} ${sectionData.color}-600-text"></i>
            </div>
            <span>${sectionTitle}</span>
          </div>
          <i class="fas fa-chevron-down sub-chevron" style="${isAutoOpen ? 'transform: rotate(180deg)' : ''}"></i>
        </button>
        <div id="${subId}-list" class="sub-items-list ${isAutoOpen ? '' : 'hidden'}">
          ${(searchTerm && matchingItems.length > 0 ? matchingItems : sectionData.items).map(item => `
            <a href="${item.url}" target="_blank" class="file-item">
              <i class="fas fa-file-alt"></i>
              <span>${item.title}</span>
              <i class="fas fa-external-link-alt link-icon"></i>
            </a>
          `).join("")}
        </div>
      `;

      // 2단계 토글 이벤트
      const subToggle = sectionEl.querySelector(".sub-section-toggle");
      const subList = sectionEl.querySelector(".sub-items-list");
      const subChevron = sectionEl.querySelector(".sub-chevron");

      subToggle.addEventListener("click", () => {
        const isHidden = subList.classList.contains("hidden");
        if (isHidden) {
          subList.classList.remove("hidden");
          subChevron.style.transform = "rotate(180deg)";
        } else {
          subList.classList.add("hidden");
          subChevron.style.transform = "rotate(0deg)";
        }
      });

      container.appendChild(sectionEl);
    });

    if (container.children.length === 0 && searchTerm) {
      container.innerHTML = '<div class="no-results">검색 결과가 없습니다.</div>';
    }
  }

  // 검색 로직
  function searchHelppageItems(categoryId, searchTerm) {
    renderHelppageSubSections(categoryId, searchTerm);
  }

  // ================= FullCalendar Logic =================
  // ================= FullCalendar Logic =================
  async function initCalendar() {
    if (calendar) {
      calendar.updateSize();
      return;
    }

    const calendarEl = document.getElementById('calendar');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const viewBtns = document.querySelectorAll('.view-btn');
    
    if (!calendarEl || typeof FullCalendar === 'undefined') return;

    // Helper: Firebase 데이터 로드
    const fetchEvents = async () => {
      if (!window.db) {
        return new Promise(resolve => {
          window.addEventListener('firebase-ready', () => resolve(fetchFromFirestore()));
          if (window.db) resolve(fetchFromFirestore());
        });
      }
      return fetchFromFirestore();
    };

    const fetchFromFirestore = async () => {
      const { db, firestoreUtils } = window;
      let existingEvents = [];
      const essentialEvents = [
        // 국경일 & 공휴일 (2026)
        { id: 'h1', title: '신정', start: '2026-01-01', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h2', title: '설날 연휴', start: '2026-02-16', end: '2026-02-20', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h3', title: '삼일절', start: '2026-03-01', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h3_sub', title: '대체공휴일', start: '2026-03-02', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h4', title: '어린이날', start: '2026-05-05', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h5', title: '부처님오신날', start: '2026-05-24', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h5_sub', title: '대체공휴일', start: '2026-05-25', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h6', title: '현충일', start: '2026-06-06', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h7', title: '제헌절', start: '2026-07-17', backgroundColor: '#4a90e2', borderColor: '#4a90e2', display: 'block', isHoliday: false },
        { id: 'h8', title: '광복절', start: '2026-08-15', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h8_sub', title: '대체공휴일', start: '2026-08-17', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h9', title: '추석 연휴', start: '2026-09-24', end: '2026-09-28', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h10', title: '개천절', start: '2026-10-03', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h10_sub', title: '대체공휴일', start: '2026-10-05', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h11', title: '한글날', start: '2026-10-09', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h12', title: '크리스마스', start: '2026-12-25', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        
        // 법정 기념일 & 주요 기념일
        { id: 'a1', title: '식목일', start: '2026-04-05', backgroundColor: '#10b981', borderColor: '#10b981', display: 'block' },
        { id: 'a2', title: '4.19 혁명 기념일', start: '2026-04-19', backgroundColor: '#64748b', borderColor: '#64748b', display: 'block' },
        { id: 'a3', title: '근로자의 날', start: '2026-05-01', backgroundColor: '#f59e0b', borderColor: '#f59e0b', display: 'block' },
        { id: 'a4', title: '어버이날', start: '2026-05-08', backgroundColor: '#ec4899', borderColor: '#ec4899', display: 'block' },
        { id: 'a5', title: '스승의 날', start: '2026-05-15', backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', display: 'block' },
        { id: 'a6', title: '5.18 민주화 운동 기념일', start: '2026-05-18', backgroundColor: '#64748b', borderColor: '#64748b', display: 'block' },
        { id: 'a7', title: '국군의 날', start: '2026-10-01', backgroundColor: '#64748b', borderColor: '#64748b', display: 'block' },
        { id: 'a8', title: '독도의 날', start: '2026-10-25', backgroundColor: '#4a90e2', borderColor: '#4a90e2', display: 'block' },

        // 24절기
        { id: 's1', title: '절기: 입춘', start: '2026-02-04', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's2', title: '절기: 우수', start: '2026-02-19', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's3', title: '절기: 경칩', start: '2026-03-05', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's4', title: '절기: 춘분', start: '2026-03-20', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's5', title: '절기: 청명', start: '2026-04-05', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's6', title: '절기: 곡우', start: '2026-04-20', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's7', title: '절기: 입하', start: '2026-05-05', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's8', title: '절기: 소만', start: '2026-05-21', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's9', title: '절기: 망종', start: '2026-06-05', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's10', title: '절기: 하지', start: '2026-06-21', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's11', title: '절기: 소서', start: '2026-07-07', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's12', title: '절기: 대서', start: '2026-07-23', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's13', title: '절기: 입추', start: '2026-08-07', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's14', title: '절기: 처서', start: '2026-08-23', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's15', title: '절기: 백로', start: '2026-09-07', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's16', title: '절기: 추분', start: '2026-09-23', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's17', title: '절기: 한로', start: '2026-10-08', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's18', title: '절기: 상강', start: '2026-10-23', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's19', title: '절기: 입동', start: '2026-11-07', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's20', title: '절기: 소설', start: '2026-11-22', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's21', title: '절기: 대설', start: '2026-12-07', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's22', title: '절기: 동지', start: '2026-12-22', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's23', title: '절기: 소한', start: '2027-01-05', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's24', title: '절기: 대한', start: '2027-01-20', backgroundColor: '#22c55e', display: 'list-item' }
      ];

      try {
        const querySnapshot = await firestoreUtils.getDocs(firestoreUtils.collection(db, "calendarEvents"));
        querySnapshot.forEach((docSnap) => {
          existingEvents.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        // 필수 일정이 누락된 경우 Firebase에 추가
        const existingIds = new Set(existingEvents.map(e => e.id));
        const missingEvents = essentialEvents.filter(e => !existingIds.has(e.id));
        
        if (missingEvents.length > 0) {
          for (const ev of missingEvents) {
            await firestoreUtils.setDoc(firestoreUtils.doc(db, "calendarEvents", ev.id), ev);
            existingEvents.push(ev);
          }
        }
      } catch (err) {
        console.error("Firebase fetch error:", err);
      }
      return existingEvents;
    };

    const savedEvents = await fetchEvents();

    try {
      const calendarOptions = {
        views: {
          multiMonthAcademic: {
            type: 'multiMonth',
            duration: { months: 12 },
            titleFormat: (info) => {
              const year = info.date.year;
              const month = info.date.month + 1;
              return year === 2026 ? month + '월' : year + '년 ' + month + '월';
            }
          },
          multiMonth2: {
            type: 'multiMonth',
            duration: { months: 2 }
          }
        },
        initialView: 'dayGridMonth', // 기본 1달 보기
        initialDate: '2026-03-01',
        multiMonthMaxColumns: 3,
        locale: 'ko',
        editable: true,
        selectable: true,
        dragScroll: true,
        eventDragMinDistance: 5,
        windowResizeDelay: 100,
        dragRevertDuration: 0,
        headerToolbar: false,
        events: savedEvents,
        height: 'auto',
        
        dayCellContent: arg => arg.dayNumberText.replace('일', ''),
        select: info => openModal(info.startStr, info.endStr),
        eventClick: info => openModal(null, null, info.event),
        eventChange: async info => await saveEventToFirebase(info.event),
        
        // 날짜/뷰 변경 시 제목 업데이트
        datesSet: function(dateInfo) {
          const monthEl = document.getElementById('calendar-current-month');
          if (!monthEl) return;

          if (dateInfo.view.type === 'multiMonthAcademic') {
            monthEl.style.display = 'none'; // 전체보기 시 중복 방지
          } else {
            monthEl.style.display = 'block';
            // FullCalendar의 view.title을 활용 (예: "2026년 3월" 또는 "2026년 3월 – 4월")
            monthEl.textContent = dateInfo.view.title;
          }
        },
        
        dayCellClassNames: function(arg) {
          const dateStr = formatDate(arg.date);
          const events = arg.view.calendar.getEvents();
          const hasHoliday = events.some(event => {
            if (!event.extendedProps.isHoliday) return false;
            const eventStart = event.startStr.split('T')[0];
            let eventEnd = event.endStr ? event.endStr.split('T')[0] : eventStart;
            if (eventStart === eventEnd && !event.endStr) {
               const d = new Date(eventStart);
               d.setDate(d.getDate() + 1);
               eventEnd = formatDate(d);
            }
            return dateStr >= eventStart && dateStr < eventEnd;
          });
          return hasHoliday ? ['fc-day-has-holiday'] : [];
        }
      };

      calendar = new FullCalendar.Calendar(calendarEl, calendarOptions);
      calendar.render();

      // Ensure proper sizing after render
      setTimeout(() => { if(calendar) calendar.updateSize(); }, 200);

      // Force update when tab becomes visible
      const calendarSection = document.getElementById('calendar-section');
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class' && !calendarSection.classList.contains('hidden')) {
                 setTimeout(() => { if(calendar) calendar.updateSize(); }, 100);
            }
        });
      });
      observer.observe(calendarSection, { attributes: true });

      // --- 통합 애니메이션 트리거 함수 ---
      const triggerTransition = (action) => {
        const wrapper = document.querySelector('.calendar-wrapper');
        wrapper.classList.add('view-transitioning');
        
        setTimeout(() => {
          action(); // 실제 이동/전환 수행
          if (calendar) calendar.updateSize(); // 레이아웃 재계산 강제
          
          setTimeout(() => {
            wrapper.classList.remove('view-transitioning');
            if (calendar) calendar.updateSize(); // 애니메이션 종료 후 최종 확인
          }, 300); // 페이드 인/스케일 업 시간
        }, 150); // 페이드 아웃/스케일 다운 대기 시간
      };

      // 보기 방식 전환 이벤트
      viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const viewName = btn.dataset.view;
          if (calendar.view.type === viewName) return;

          triggerTransition(() => {
            let cols = 1;
            if (viewName === 'multiMonth2') cols = 2;
            if (viewName === 'multiMonthAcademic') cols = 3;
            
            calendar.setOption('multiMonthMaxColumns', cols);
            calendar.changeView(viewName);
            
            viewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (viewName === 'multiMonthAcademic') {
              prevBtn.classList.add('hidden');
              nextBtn.classList.add('hidden');
            } else {
              prevBtn.classList.remove('hidden');
              nextBtn.classList.remove('hidden');
            }
          });
        });
      });

      // 네비게이션 화살표 이벤트
      prevBtn.addEventListener('click', () => triggerTransition(() => calendar.prev()));
      nextBtn.addEventListener('click', () => triggerTransition(() => calendar.next()));

      // 통합 마우스 휠 네비게이션 (역동적 전환 효과 포함)
      const container = document.querySelector('.calendar-container');
      let isThrottled = false;
      
      container.addEventListener('wheel', (e) => {
        const currentView = calendar.view.type;
        if (currentView === 'multiMonthAcademic') return; 

        e.preventDefault();
        if (isThrottled) return;
        
        if (Math.abs(e.deltaY) > 20) {
          isThrottled = true;
          const direction = e.deltaY > 0 ? 'next' : 'prev';
          
          triggerTransition(() => {
            if (direction === 'next') calendar.next();
            else calendar.prev();
          });

          setTimeout(() => { isThrottled = false; }, 800); // 과도한 휠 조작 방지
        }
      }, { passive: false });

      setTimeout(() => { if (calendar) calendar.updateSize(); }, 500);

    } catch (err) {
      console.error('FullCalendar Error:', err);
    }
  }

  // Firebase 저장 도우미
  async function saveEventToFirebase(fcEvent) {
    if (!window.db) return;
    const { db, firestoreUtils } = window;
    try {
      await firestoreUtils.setDoc(firestoreUtils.doc(db, "calendarEvents", fcEvent.id), {
        title: fcEvent.title,
        start: fcEvent.startStr,
        end: fcEvent.endStr,
        backgroundColor: fcEvent.backgroundColor,
        borderColor: fcEvent.borderColor,
        isHoliday: fcEvent.extendedProps.isHoliday || false, // 공휴일 여부 저장
        description: fcEvent.extendedProps.description || ""
      });
      // 데이터 변경 후 달력 다시 그리기 (날짜 색상 업데이트용)
      calendar.view.calendar.releaseAfterRender = true;
      calendar.render();
      if (window.updateTodayWidget) window.updateTodayWidget(); // 위젯 업데이트
    } catch (err) {
      console.error("Firebase save error:", err);
    }
  }

  // 모달 관련 요소
  const eventModal = document.getElementById('eventModal');
  const eventForm = document.getElementById('eventForm');
  const deleteBtn = document.getElementById('deleteEventBtn');
  const holidayCheckbox = document.getElementById('event-is-holiday');
  const closeModalBtns = document.querySelectorAll('.close-modal');
  const colorOptions = document.querySelectorAll('.color-option');
  let selectedColor = '#4a90e2';

  // 모달 열기
  function openModal(start, end, event = null) {
    eventModal.classList.add('active');
    eventForm.reset();
    
    if (event) {
      document.getElementById('modalTitle').textContent = '일정 수정';
      document.getElementById('event-id').value = event.id;
      document.getElementById('event-title').value = event.title;
      document.getElementById('event-start').value = formatDate(event.start);
      document.getElementById('event-end').value = event.end ? formatDate(event.end, -1) : formatDate(event.start);
      document.getElementById('event-description').value = event.extendedProps.description || '';
      holidayCheckbox.checked = event.extendedProps.isHoliday || false; // 체크박스 상태 복구
      selectedColor = event.backgroundColor;
      deleteBtn.classList.remove('hidden');
    } else {
      document.getElementById('modalTitle').textContent = '일정 등록';
      document.getElementById('event-id').value = '';
      document.getElementById('event-start').value = start;
      let endDate = new Date(end);
      endDate.setDate(endDate.getDate() - 1);
      document.getElementById('event-end').value = formatDate(endDate);
      holidayCheckbox.checked = false; // 기본값: 미체크
      deleteBtn.classList.add('hidden');
      selectedColor = '#4a90e2';
    }
    updateColorPicker();
  }

  function closeModal() {
    eventModal.classList.remove('active');
  }

  closeModalBtns.forEach(btn => btn.addEventListener('click', closeModal));
  window.addEventListener('click', (e) => { if(e.target === eventModal) closeModal(); });

  colorOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      selectedColor = opt.dataset.color;
      updateColorPicker();
    });
  });

  function updateColorPicker() {
    colorOptions.forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.color === selectedColor);
    });
  }



  // 일정 저장 (등록/수정)
  eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('event-id').value || Date.now().toString();
    const title = document.getElementById('event-title').value;
    const start = document.getElementById('event-start').value;
    const endInput = document.getElementById('event-end').value;
    const description = document.getElementById('event-description').value;
    const isHoliday = holidayCheckbox.checked;

    let endDate = new Date(endInput);
    endDate.setDate(endDate.getDate() + 1);
    const endFormatted = endDate.toISOString().split('T')[0];

    // 공휴일 체크 시 강제 빨간색, 아닐 경우 선택 색상 사용
    const finalColor = isHoliday ? '#ef4444' : selectedColor;

    const eventData = {
      id: id,
      title: title,
      start: start,
      end: endFormatted,
      backgroundColor: finalColor,
      borderColor: finalColor,
      extendedProps: { 
        description: description,
        isHoliday: isHoliday 
      }
    };

    const existingEvent = calendar.getEventById(id);
    if (existingEvent) {
      existingEvent.remove();
    }
    calendar.addEvent(eventData);
    
    // Firebase 저장
    await saveEventToFirebase(calendar.getEventById(id));
    closeModal();
    // 가시성 클래스 업데이트를 위해 렌더링 호출
    calendar.render();
  });

  // 일정 삭제
  deleteBtn.addEventListener('click', async () => {
    const id = document.getElementById('event-id').value;
    const event = calendar.getEventById(id);
    if (event && confirm('이 일정을 삭제하시겠습니까?')) {
      if (window.db) {
        const { db, firestoreUtils } = window;
        await firestoreUtils.deleteDoc(firestoreUtils.doc(db, "calendarEvents", id));
      }
      event.remove();
      closeModal();
      calendar.render(); // 날짜 색상 복구
      if (window.updateTodayWidget) window.updateTodayWidget(); // 위젯 업데이트
    }
  });


  /* ================= 학교계정 (School Account) Logic ================= */
  let localAccountData = [];
  let accountEditMode = false;

  async function initAccount() {
    if (localAccountData.length === 0) {
      await loadAccountsFromFirebase();
    } else {
      renderAccountTable();
    }
    initAccountEditing();
  }

  async function loadAccountsFromFirebase() {
    if (!window.db) {
      localAccountData = [];
      renderAccountTable();
      return;
    }
    const { db, firestoreUtils } = window;
    try {
      const q = firestoreUtils.query(firestoreUtils.collection(db, "schoolAccounts"));
      const querySnapshot = await firestoreUtils.getDocs(q);
      const loaded = [];
      querySnapshot.forEach(doc => {
        loaded.push({ id: doc.id, ...doc.data() });
      });
      loaded.sort((a, b) => (a.order || 0) - (b.order || 0));
      localAccountData = loaded;
      renderAccountTable();
    } catch (err) {
      console.error("Account load error:", err);
      renderAccountTable();
    }
  }

  function renderAccountTable() {
    const tableBody = document.getElementById("account-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    
    // Toggle edit col visibility based on mode
    const editCols = document.querySelectorAll(".account-table .edit-col");
    editCols.forEach(col => {
      if (accountEditMode) col.classList.remove("hidden");
      else col.classList.add("hidden");
    });

    localAccountData.forEach((acc, index) => {
      const tr = document.createElement("tr");
      tr.dataset.id = acc.id;
      
      tr.innerHTML = `
        <td>
          ${accountEditMode ? '<i class="fas fa-grip-lines drag-handle"></i>' : ""}
          ${index + 1}
        </td>
        <td>
          ${acc.url ? 
            `<a href="${acc.url}" target="_blank" class="account-service-link"><i class="fas fa-external-link-alt"></i> ${acc.service}</a>` : 
            `<span class="font-bold">${acc.service}</span>`
          }
        </td>
        <td>
          <div class="copyable-field" onclick="copyToClipboard('${acc.username}', this)" title="클릭하여 복사">
            ${acc.username}
          </div>
        </td>
        <td>
          <div class="copyable-field" onclick="copyToClipboard('${acc.password}', this)" title="클릭하여 복사">
            ${acc.password}
          </div>
        </td>
        <td>
          <div class="account-note">${acc.note || ""}</div>
        </td>
        <td class="edit-col ${accountEditMode ? "" : "hidden"}">
          <div class="account-actions">
            <button class="btn-icon btn-edit-sm" onclick="openAccountModal('${acc.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn-icon btn-delete-sm" onclick="deleteAccount('${acc.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    if (accountEditMode && window.Sortable) {
      Sortable.create(tableBody, {
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: () => {
          const newOrder = [];
          tableBody.querySelectorAll('tr').forEach((row, idx) => {
            const id = row.dataset.id;
            const item = localAccountData.find(a => a.id === id);
            if (item) {
              item.order = idx;
              newOrder.push(item);
            }
          });
          // Update numbers visually without full re-render
          tableBody.querySelectorAll('tr').forEach((row, idx) => {
             const numCell = row.querySelector('td:first-child');
             if(numCell) {
                 numCell.innerHTML = `<i class="fas fa-grip-lines drag-handle"></i> ${idx + 1}`;
             }
          });
          localAccountData = newOrder;
        }
      });
    }
  }

  function initAccountEditing() {
    const editModeBtn = document.getElementById("account-edit-mode-btn");
    const editActions = document.getElementById("account-edit-actions");
    const addBtn = document.getElementById("account-add-btn");
    const saveBtn = document.getElementById("account-save-btn");
    const cancelBtn = document.getElementById("account-cancel-btn");

    if (!editModeBtn) return;

    editModeBtn.onclick = () => {
      accountEditMode = true;
      editModeBtn.classList.add("hidden");
      editActions.classList.remove("hidden");
      renderAccountTable();
    };

    addBtn.onclick = () => openAccountModal();

    cancelBtn.onclick = () => {
      if (confirm("변경사항을 취소하시겠습니까?")) {
        accountEditMode = false;
        editActions.classList.add("hidden");
        loadAccountsFromFirebase(); // Reload original data
      }
    };

    saveBtn.onclick = async () => {
      if (window.db) {
        const { db, firestoreUtils } = window;
        try {
          for (const acc of localAccountData) {
            await firestoreUtils.setDoc(firestoreUtils.doc(db, "schoolAccounts", acc.id), acc);
          }
          alert("저장되었습니다.");
          accountEditMode = false;
          editActions.classList.add("hidden");
          renderAccountTable();
        } catch (err) {
          console.error(err);
          alert("저장 중 오류가 발생했습니다.");
        }
      } else {
        alert("로컬 모드에서는 저장할 수 없습니다.");
      }
    };

    // Excel Import
    const importBtn = document.getElementById("account-import-btn");
    const excelInput = document.getElementById("account-excel-input");
    if(importBtn && excelInput) {
        importBtn.onclick = () => excelInput.click();
        excelInput.onchange = (e) => {
            const file = e.target.files[0];
            if(!file) return;
            handleAccountExcelImport(file);
            e.target.value = ''; // Reset
        };
    }

    // Template Download
    const templateBtn = document.getElementById("account-template-btn");
    if(templateBtn) {
        templateBtn.onclick = () => downloadAccountExcelTemplate();
    }
  }

  function handleAccountExcelImport(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const data = new Uint8Array(e.target.result);
              const workbook = XLSX.read(data, { type: 'array' });
              const firstSheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[firstSheetName];
              const jsonData = XLSX.utils.sheet_to_json(worksheet);

              if (jsonData.length === 0) {
                  alert("엑셀 파일에 데이터가 없습니다.");
                  return;
              }

              // Mapping fields: 서비스명, URL, 아이디, 비밀번호, 비고
              const newAccounts = jsonData.map((row, idx) => {
                  return {
                      id: "acc-" + Date.now() + "-" + idx,
                      service: row['서비스명'] || row['Service'] || "미지정 서비스",
                      url: row['URL'] || row['Link'] || "",
                      username: row['아이디'] || row['ID'] || row['Username'] || "",
                      password: row['비밀번호'] || row['PW'] || row['Password'] || "",
                      note: row['비고'] || row['Note'] || "",
                      order: localAccountData.length + idx
                  };
              });

              localAccountData = [...localAccountData, ...newAccounts];
              renderAccountTable();
              alert(`${newAccounts.length}개의 계정 정보가 추가되었습니다. '저장 완료'를 눌러야 반영됩니다.`);
          } catch (err) {
              console.error("Excel import error:", err);
              alert("엑셀 파일을 읽는 중 오류가 발생했습니다. 올바른 형식인지 확인해주세요.");
          }
      };
      reader.readAsArrayBuffer(file);
  }

  function downloadAccountExcelTemplate() {
      const templateData = [
          { "서비스명": "예: 구글 워크스페이스", "URL": "https://service.link", "아이디": "admin@school.com", "비밀번호": "pass1234", "비고": "교사 공용" },
          { "서비스명": "예: 나이스", "URL": "https://neis.go.kr", "아이디": "neis_id", "비밀번호": "neis_pw", "비고": "행정팀" }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "계정정보_서식");

      // Column widths
      worksheet['!cols'] = [
          { wch: 20 }, // 서비스명
          { wch: 30 }, // URL
          { wch: 20 }, // 아이디
          { wch: 15 }, // 비밀번호
          { wch: 30 }  // 비고
      ];

      XLSX.writeFile(workbook, "학교계정_등록_서식.xlsx");
  }

  window.openAccountModal = (id = null) => {
    const modal = document.getElementById("accountModal");
    const form = document.getElementById("accountForm");
    const title = document.getElementById("accountModalTitle");
    
    form.reset();
    document.getElementById("account-id").value = id || "";
    
    if (id) {
      title.textContent = "계정 정보 수정";
      const acc = localAccountData.find(a => a.id === id);
      if (acc) {
        document.getElementById("account-service").value = acc.service;
        document.getElementById("account-url").value = acc.url || "";
        document.getElementById("account-username").value = acc.username;
        document.getElementById("account-password").value = acc.password;
        document.getElementById("account-note").value = acc.note || "";
      }
    } else {
      title.textContent = "계정 정보 등록";
    }
    
    modal.classList.add("active");
  };

  const closeAccountModals = document.querySelectorAll(".close-account-modal");
  closeAccountModals.forEach(btn => {
    btn.onclick = () => document.getElementById("accountModal").classList.remove("active");
  });

  document.getElementById("accountForm").onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById("account-id").value;
    const service = document.getElementById("account-service").value;
    const url = document.getElementById("account-url").value;
    const username = document.getElementById("account-username").value;
    const password = document.getElementById("account-password").value;
    const note = document.getElementById("account-note").value;

    if (id) {
      const idx = localAccountData.findIndex(a => a.id === id);
      if (idx !== -1) {
        localAccountData[idx] = { ...localAccountData[idx], service, url, username, password, note };
      }
    } else {
      const newId = "acc-" + Date.now();
      localAccountData.push({
        id: newId,
        service,
        url,
        username,
        password,
        note,
        order: localAccountData.length
      });
    }

    document.getElementById("accountModal").classList.remove("active");
    renderAccountTable();
  };

  window.deleteAccount = (id) => {
    if (confirm("이 계정 정보를 삭제하시겠습니까?")) {
      localAccountData = localAccountData.filter(a => a.id !== id);
      // Re-order
      localAccountData.forEach((acc, idx) => acc.order = idx);
      
      // If deleted from Firebase instantly or wait for save?
      // For consistency with edit mode, let's keep it in local until "Save" is clicked.
      renderAccountTable();
    }
  };

  window.copyToClipboard = (text, element) => {
    navigator.clipboard.writeText(text).then(() => {
      // Log copy action
      if(window.logUserAction) {
          const type = element.closest('td').previousElementSibling?.previousElementSibling ? '비밀번호' : '아이디';
          const serviceName = element.closest('tr').querySelector('td:nth-child(2)')?.textContent.trim();
          window.logUserAction('account', '복사', `${serviceName} 계정의 ${type} 복사`);
      }

      // Small feedback animation
      element.classList.add("copied-flash");
      const originalText = element.textContent;
      element.textContent = "복사됨!";
      setTimeout(() => {
        element.classList.remove("copied-flash");
        element.textContent = text;
      }, 1000);
    }).catch(err => {
      console.error('Copy failed', err);
    });
  };

  function saveAllEvents() {
    // Firebase 연동으로 인해 더 이상 필요하지 않으나 하위 호환성을 위해 유지
  }

  // 카테고리 클릭 이벤트
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      // 1. 방향 결정 (Direction Calculation)
      const oldActive = document.querySelector('.nav-item.active');
      let direction = 'none';
      
      if (oldActive && oldActive !== item) {
          const allTabs = Array.from(document.querySelectorAll('.nav-item'));
          const visibleTabs = allTabs.filter(t => getComputedStyle(t).display !== 'none');
          
          const oldIndex = visibleTabs.indexOf(oldActive);
          const newIndex = visibleTabs.indexOf(item);
          
          if (oldIndex !== -1 && newIndex !== -1) {
             if (newIndex > oldIndex) direction = 'right'; // Next Tab (Swipe Left)
             else direction = 'left'; // Prev Tab (Swipe Right)
          }
      }

      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");
      currentCategory = item.getAttribute("data-category");
      document.body.setAttribute('data-tab', currentCategory); // Added for theme backgrounds

      // Log User Action
      if(window.logUserAction) window.logUserAction(currentCategory);

      // 모든 섹션 숨기기 및 애니메이션 클래스 초기화
      const allSections = [
        linksGrid, 
        statusSection, 
        curriculumSection,
        datayardSection, 
        helppageSection, 
        accountSection,
        busSection,
        calendarSection,
        adminSection,
        document.getElementById("intro-section")
      ];
      
      allSections.forEach(sec => {
        if (sec) {
            sec.classList.add("hidden");
            sec.classList.remove('animate-slide-in-right', 'animate-slide-in-left');
        }
      });
      
      document.documentElement.classList.remove("intro-active");
      document.body.classList.toggle('hide-widget', currentCategory === 'curriculum');

      let targetSection = null;

      if (currentCategory === "status") {
        statusSection.classList.remove("hidden");
        targetSection = statusSection;
        initStatusEditing(); 
      } else if (currentCategory === "curriculum") {
        curriculumSection.classList.remove("hidden");
        targetSection = curriculumSection;
      } else if (currentCategory === "datayard") {
        datayardSection.classList.remove("hidden");
        targetSection = datayardSection;
        initDatayard();
      } else if (currentCategory === "support") {
        helppageSection.classList.remove("hidden");
        targetSection = helppageSection;
        renderHelppage();
      } else if (currentCategory === "account") {
        accountSection.classList.remove("hidden");
        targetSection = accountSection;
        initAccount();
      } else if (currentCategory === "bus") {
        busSection.classList.remove("hidden");
        targetSection = busSection;
        initBus();
      } else if (currentCategory === "calendar") {
        calendarSection.classList.remove("hidden");
        targetSection = calendarSection;
        initCalendar();
      } else if (currentCategory === "admin") {
        adminSection.classList.remove("hidden");
        targetSection = adminSection;
        window.switchAdminView('dashboard');
      } else if (currentCategory === "all") {
        const intro = document.getElementById("intro-section");
        intro.classList.remove("hidden");
        targetSection = intro;
        document.documentElement.classList.add("intro-active");
      } else {
        linksGrid.classList.remove("hidden");
        targetSection = linksGrid;
        renderCards();
      }
      
      // 2. 애니메이션 적용 (Apply Animation) - 모바일 전용
      if (targetSection && direction !== 'none' && window.innerWidth <= 768) {
          // Force Reflow
          void targetSection.offsetWidth;
          
          if (direction === 'right') {
              targetSection.classList.add('animate-slide-in-right');
          } else {
              targetSection.classList.add('animate-slide-in-left');
          }
      }
    });
  });

  // 초기 렌더링 (소개 섹션 표시)
  document.getElementById("intro-section").classList.remove("hidden");
  document.documentElement.classList.add("intro-active");


  // ================= Intro Section Canvas Animation =================
  function initIntroCanvas() {
    const canvas = document.getElementById("intro-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let particles = [];
    const particleCount = 40;
    
    let mouse = { x: -100, y: -100 };

    window.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect) return;
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });

    class Particle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.alpha = Math.random() * 0.5 + 0.1;
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Mouse attraction
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          this.x += dx * 0.01;
          this.y += dy * 0.01;
        }

        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(74, 144, 226, ${this.alpha})`;
        ctx.fill();
      }
    }

    function resize() {
      if (!canvas.offsetWidth) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      particles = [];
      for (let i = 0; i < particleCount; i++) particles.push(new Particle());
    }

    function animate() {
      if (!document.getElementById("intro-section") || document.getElementById("intro-section").classList.contains("hidden")) {
        requestAnimationFrame(animate);
        return;
      }
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(74, 144, 226, ${0.2 * (1 - dist / 100)})`;
            ctx.stroke();
          }
        }
      }

      particles.forEach(p => {
        p.update();
        p.draw();
      });
      requestAnimationFrame(animate);
    }

    window.addEventListener("resize", resize);
    resize();
    animate();
  }

  // ================= Intro Smooth Scroll & Animation =================
  function initIntroAnimations() {
    const introSection = document.getElementById("intro-section");
    const steps = document.querySelectorAll(".intro-step");
    if (!introSection || steps.length === 0) return;

    // 1. Intersection Observer for fade-in effect
    const observerOptions = {
        root: null, // Viewport
        threshold: 0.1
    };

    const stepObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = "1";
                entry.target.style.transform = "translateY(0)";
            } else {
                entry.target.style.opacity = "0.3";
                entry.target.style.transform = "translateY(20px)";
            }
        });
    }, observerOptions);

    steps.forEach(step => {
        // Initial state
        step.style.opacity = "0.3";
        step.style.transform = "translateY(20px)";
        step.style.transition = "all 1s cubic-bezier(0.2, 0.8, 0.2, 1)";
        stepObserver.observe(step);
    });

    // 2. Wheel event smoothing for Desktop
    let isScrolling = false;
    introSection.addEventListener('wheel', (e) => {
        if (isScrolling) return;
        
        // Prevent default only if we are actually at a snap point
        // and intent is clear (deltaY is significant)
        if (Math.abs(e.deltaY) < 30) return;

        isScrolling = true;
        setTimeout(() => { isScrolling = false; }, 1000); // Throttling
    }, { passive: true });
  }

  // Initialize
  initIntroAnimations();
  initIntroCanvas();
  initTodayWidget();

  // ================= Today Widget Logic =================
  function initTodayWidget() {
    const todayMonthDay = document.getElementById('today-month-day');
    const todayWeekday = document.getElementById('today-weekday');
    const eventList = document.getElementById('today-event-list');
    const addBtn = document.getElementById('widget-add-btn');
    const todayWidget = document.getElementById('school-today-widget');
    const toggleBtn = document.getElementById('today-toggle-btn');
    const header = document.getElementById('today-widget-header');

    if (!todayMonthDay || !eventList) return;
    
    // Toggle Logic
    const toggleCollapse = (e) => {
        // Prevent toggling when clicking buttons inside header
        if (e && e.target.closest('button')) return;
        
        todayWidget.classList.toggle('collapsed');
        const icon = toggleBtn.querySelector('i');
        if (todayWidget.classList.contains('collapsed')) {
            icon.className = 'fas fa-chevron-down';
        } else {
            icon.className = 'fas fa-chevron-up';
        }
    };
    
    if (toggleBtn) {
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            // Manually trigger logic directly for the button
            todayWidget.classList.toggle('collapsed');
            const icon = toggleBtn.querySelector('i');
            icon.className = todayWidget.classList.contains('collapsed') ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
        };
    }
    
    if (header) {
        header.onclick = toggleCollapse;
    }

    // Data Store
    let allRawEvents = [];
    let isWidgetSyncSetup = false;

    // 1. Render Function (Pure rendering based on current date & stored data)
    const renderTodayWidget = () => {
        const now = new Date();
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        
        // Update Date Display
        todayMonthDay.textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일(${days[now.getDay()]})`;
        
        // Filter Events for Today
        const todayStr = formatDate(now);
        const todayEvents = [];

        // 1. Fetch Auto Events (Holidays/Terms)
        let autoEvents = [];
        if (window.KoreanHolidayService) {
            autoEvents = window.KoreanHolidayService.getAutoEvents(now.getFullYear(), now.getMonth());
        }
        
        // Merge DB events and Auto events (Deduplicate: Prefer DB events if ID conflicts)
        const dbEventIds = new Set(allRawEvents.map(e => e.id));
        const uniqueAutoEvents = autoEvents.filter(e => !dbEventIds.has(e.id));
        const combinedEvents = [...allRawEvents, ...uniqueAutoEvents];

        combinedEvents.forEach(data => {
             const start = data.start;
             let end = data.end || start;
             if (todayStr >= start && todayStr <= end) {
                 todayEvents.push(data);
             }
        });

        // SORT by orderIndex
        todayEvents.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

        // 1. Special Day (Life) in Header
        const specialDays = todayEvents
            .filter(ev => ev.eventType === 'life' && ev.title && ev.title.trim() !== '')
            .map(ev => ev.title);
            
        const uniqueSpecialDays = [...new Set(specialDays)];

        if (uniqueSpecialDays.length > 0) {
            todayWeekday.textContent = uniqueSpecialDays.join(', ');
            todayWeekday.style.color = "#3b82f6"; // Changed to Blue
        } else {
            todayWeekday.textContent = "";
        }

        // 2. Render List
        const categories = [
            { id: 'edu', label: '교육활동', icon: 'fa-chalkboard-teacher', types: ['edu'] },
            { id: 'staff', label: '교직원 복무', icon: 'fa-user-clock', types: ['staff'] },
            { id: 'doc', label: '처리할 공문', icon: 'fa-file-signature', types: ['doc'] }
        ];

        eventList.innerHTML = '';
        const otherEvents = todayEvents.filter(ev => ev.eventType !== 'life');

        if (otherEvents.length === 0) {
            const li = document.createElement('li');
            li.className = 'no-event';
            li.textContent = '오늘 학사일정이 없습니다.';
            eventList.appendChild(li);
        } else {
            categories.forEach(cat => {
                const catEvents = otherEvents.filter(ev => cat.types.includes(ev.eventType));
                
                if (catEvents.length > 0) {
                    const titleDiv = document.createElement('div');
                    titleDiv.className = 'category-title';
                    titleDiv.innerHTML = `<i class="fas ${cat.icon}"></i> ${cat.label}`;
                    eventList.appendChild(titleDiv);

                    const groupDiv = document.createElement('div');
                    groupDiv.className = 'category-group';

                    catEvents.forEach(ev => {
                        const li = document.createElement('li');
                        const isCompleted = ev.eventType === 'doc' && ev.isCompleted;
                        li.className = `event-item type-${ev.eventType} ${ev.isHoliday ? 'is-holiday' : ''} ${isCompleted ? 'completed' : ''}`;
                        
                        let displayText = ev.title;
                        if (ev.eventType === 'staff') {
                            // Add space between Name and Status
                            displayText = `${ev.title} (${ev.staffStatus || '미정'})`;
                        }
                        
                        // Icon Logic
                        let iconClass = 'fa-check';
                        if (ev.isHoliday) iconClass = 'fa-flag';
                        else if (ev.eventType === 'staff') iconClass = 'fa-user-check'; // Specific icon for staff
                        else if (ev.eventType === 'edu') iconClass = 'fa-chalkboard';
                        else if (ev.eventType === 'doc') {
                            iconClass = isCompleted ? 'fa-check-circle' : 'fa-file-alt';
                        }

                        li.innerHTML = `<i class="fas ${iconClass}"></i><span>${displayText}</span>`;

                        // Tooltip Construction (HTML List for Detail View)
                        let info = [];
                        if (ev.eventType === 'edu') {
                            if (ev.time) info.push(`<li><b>시간:</b> ${ev.time}</li>`);
                            if (ev.place) info.push(`<li><b>장소:</b> ${ev.place}</li>`);
                            if (ev.target) info.push(`<li><b>대상:</b> ${ev.target}</li>`);
                            if (ev.inCharge) info.push(`<li><b>담당:</b> ${ev.inCharge}</li>`);
                        } else if (ev.eventType === 'staff') {
                            info.push(`<li><b>이름:</b> ${ev.title}</li>`); 
                            info.push(`<li><b>복무:</b> ${ev.staffStatus || '미정'}</li>`);
                            if (ev.place) info.push(`<li><b>장소:</b> ${ev.place}</li>`);
                            if (ev.time) info.push(`<li><b>시간:</b> ${ev.time}</li>`);
                        } else if (ev.eventType === 'doc') {
                            if (ev.inCharge) info.push(`<li><b>담당:</b> ${ev.inCharge}</li>`);
                        }
                        
                        // Only add tooltip event if there IS info to show
                        const tooltipContent = info.length > 0 ? `<ul class="tooltip-list">${info.join('')}</ul>` : "";
                        
                        if (info.length > 0) {
                            li.onmouseenter = (e) => showFloatingTooltip(e, tooltipContent);
                            li.onmouseleave = hideFloatingTooltip;
                        }

                        li.onclick = () => {
                            const navCurr = document.querySelector('[data-category="curriculum"]');
                            if (navCurr) navCurr.click();
                        };
                        groupDiv.appendChild(li);
                    });
                    eventList.appendChild(groupDiv);
                }
            });
        }
    };

    // 2. Sync Setup
    const setupTodayWidgetSync = () => {
        if (!window.db || isWidgetSyncSetup) return;
        
        isWidgetSyncSetup = true;
        const { db, firestoreUtils } = window;

        // Listen for updates
        firestoreUtils.onSnapshot(firestoreUtils.collection(db, "curriculum_events"), (querySnapshot) => {
            allRawEvents = [];
            querySnapshot.forEach((docSnap) => {
                allRawEvents.push({ id: docSnap.id, ...docSnap.data() });
            });
            renderTodayWidget();
        });
    };

    // Tooltip Logic (Global Element)
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'widget-floating-tooltip';
    document.body.appendChild(tooltipEl);

    function showFloatingTooltip(e, content) {
        if(!content) return;
        tooltipEl.innerHTML = content; // Changed to innerHTML for HTML content
        tooltipEl.style.display = 'block'; 
        
        // Measure tooltip
        const tooltipRect = tooltipEl.getBoundingClientRect();
        const targetRect = e.target.getBoundingClientRect();
        
        // Position: Right of the target, Vertically centered
        // targetRect.right + gap
        const x = targetRect.right + 12; 
        // targetRect.top + half_height - half_tooltip_height
        const y = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        
        tooltipEl.style.left = x + 'px';
        tooltipEl.style.top = y + 'px';
        
        requestAnimationFrame(() => {
           tooltipEl.classList.add('active');
        });
    }

    function hideFloatingTooltip() {
        tooltipEl.classList.remove('active');
        tooltipEl.style.display = 'none';
    }

    // Init
    if (window.db) setupTodayWidgetSync();
    window.addEventListener('firebase-ready', setupTodayWidgetSync);
    
    // Add Button
    addBtn.onclick = () => {
        const todayStr = formatDate(new Date());
        const navCurr = document.querySelector('[data-category="curriculum"]');
        if (navCurr) navCurr.click();
        if (typeof window.openCurrModal === 'function') window.openCurrModal(todayStr);
    };

    // Auto Refresh (Hourly)
    setInterval(renderTodayWidget, 3600000);
    renderTodayWidget(); // Initial Render

    // Expose for compatibility (manual triggers just re-render local data)
    window.updateTodayWidget = renderTodayWidget;
  }

  // ================= Notice Widget Logic =================
  async function initNoticeBoard() {
    const noticeWidget = document.getElementById('notice-widget');
    const noticeContent = document.getElementById('notice-widget-content');
    const addPostBtn = document.getElementById('notice-add-btn');
    const toggleBtn = document.getElementById('notice-toggle-btn');
    const header = document.getElementById('notice-widget-header');

    const modal = document.getElementById('boardPostModal');
    const form = document.getElementById('boardPostForm');
    const closeModalBtns = document.querySelectorAll('.close-board-modal');
    const editor = document.getElementById('post-content-editor');
    const authorChipsContainer = document.getElementById('post-author-chips');
    const selectedAuthorInput = document.getElementById('selected-post-author');
    const customAuthorInput = document.getElementById('post-author-custom');
    const colorTrigger = document.getElementById('color-trigger');
    const colorPopover = document.getElementById('color-popover');
    const colorOptions = document.querySelectorAll('#color-popover .color-option');
    const fileDropZone = document.getElementById('file-drop-zone');
    const fileInput = document.getElementById('post-file-input');
    const filePreview = document.getElementById('file-preview-area');
    const fileNameDisplay = document.getElementById('file-name-display');
    const removeFileBtn = document.getElementById('remove-file-btn');

    let selectedColor = '#fff9c4';
    let selectedFile = null;

    if (!noticeContent) return;

    // Toggle Collapse
    const toggleCollapse = (e) => {
        // Prevent if clicking add button
        if (e && e.target.closest('#notice-add-btn')) return;
        
        noticeWidget.classList.toggle('collapsed');
        const icon = toggleBtn.querySelector('i');
        if (noticeWidget.classList.contains('collapsed')) {
            icon.className = 'fas fa-chevron-down';
        } else {
            icon.className = 'fas fa-chevron-up';
        }
    };
    
    toggleBtn.onclick = (e) => {
        e.stopPropagation();
        toggleCollapse(e);
    };
    header.onclick = toggleCollapse; // Click anywhere on header to toggle

    // --- 2. Author Chips Population ---
    const authors = ["교장", "행정실장", "1·2학년", "3학년", "4학년", "5학년", "6학년", "유치원", "교무", "영양", "차장", "운전주무관", "교무행정원", "직접 입력"];
    
    const renderAuthorChips = () => {
        authorChipsContainer.innerHTML = '';
        authors.forEach((author) => {
            const chip = document.createElement('div');
            chip.className = 'author-chip';
            if (selectedAuthorInput.value === author) chip.classList.add('selected');
            chip.textContent = author;
            chip.onclick = () => {
                selectedAuthorInput.value = author;
                document.querySelectorAll('.author-chip').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
                
                if (author === '직접 입력') {
                    customAuthorInput.style.display = 'block';
                    customAuthorInput.focus();
                } else {
                    customAuthorInput.style.display = 'none';
                }
            };
            authorChipsContainer.appendChild(chip);
        });
    };

    // --- 4. Color Picker Popover Logic ---
    colorTrigger.onclick = (e) => {
        e.stopPropagation();
        colorPopover.classList.toggle('active');
    };

    document.addEventListener('click', (e) => {
        if (!colorTrigger.contains(e.target) && !colorPopover.contains(e.target)) {
            colorPopover.classList.remove('active');
        }
    });

    colorOptions.forEach(opt => {
      opt.onclick = () => {
        colorOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selectedColor = opt.dataset.color;
        colorTrigger.style.backgroundColor = selectedColor;
        colorPopover.classList.remove('active');
      };
    });

    // --- 3. File Upload Logic ---
    const handleFile = (file) => {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            alert('파일 크기는 10MB 이하만 가능합니다.');
            return;
        }
        selectedFile = file;
        fileNameDisplay.textContent = file.name;
        filePreview.classList.remove('hidden');
        fileDropZone.classList.add('hidden');
    };

    fileDropZone.onclick = () => fileInput.click();
    fileInput.onchange = (e) => handleFile(e.target.files[0]);

    fileDropZone.ondragover = (e) => {
        e.preventDefault();
        fileDropZone.classList.add('dragover');
    };
    fileDropZone.ondragleave = () => fileDropZone.classList.remove('dragover');
    fileDropZone.ondrop = (e) => {
        e.preventDefault();
        fileDropZone.classList.remove('dragover');
        handleFile(e.dataTransfer.files[0]);
    };

    removeFileBtn.onclick = () => {
        selectedFile = null;
        fileInput.value = '';
        filePreview.classList.add('hidden');
        fileDropZone.classList.remove('hidden');
    };

    // 2. Load and Render Posts
    const loadBoard = async () => {
      if (!window.db) return;
      const { db, firestoreUtils } = window;
      try {
        const q = firestoreUtils.query(firestoreUtils.collection(db, "boardPosts"));
        const querySnapshot = await firestoreUtils.getDocs(q);
        
        const posts = [];
        querySnapshot.forEach(doc => {
          posts.push({ id: doc.id, ...doc.data() });
        });
        
        posts.sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        renderPosts(posts);
        initSortable();
      } catch (err) {
        console.error("Board load error:", err);
      }
    };

    let sortableInstance = null;
    const initSortable = () => {
      const list = noticeContent.querySelector('.notice-list');
      if (!list) return;
      
      if (sortableInstance) sortableInstance.destroy();
      
      if (window.Sortable) {
          sortableInstance = new Sortable(list, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onStart: () => list.classList.add('sorting'),
            onEnd: async (evt) => {
              list.classList.remove('sorting');
              if (evt.oldIndex === evt.newIndex) return;
              
              const items = Array.from(list.querySelectorAll('.notice-item'));
              const { db, firestoreUtils } = window;
              
              try {
                // Batch update or individual updates
                // For simplicity here, individual updates
                const promises = items.map((item, index) => {
                  const id = item.dataset.id;
                  return firestoreUtils.setDoc(firestoreUtils.doc(db, "boardPosts", id), { order: index }, { merge: true });
                });
                await Promise.all(promises);
              } catch (err) {
                console.error("Order save error:", err);
              }
            }
          });
      }
    };

    const renderPosts = (posts) => {
      noticeContent.innerHTML = '<div class="notice-list"></div>';
      const list = noticeContent.querySelector('.notice-list');
      
      if (posts.length === 0) {
        list.innerHTML = '<div class="no-event">등록된 소식이 없습니다.</div>';
        return;
      }
      
      posts.forEach(post => {
        const item = document.createElement('div');
        item.className = `notice-item status-${post.status || 'normal'}`;
        item.dataset.id = post.id;
        if (post.color) item.style.backgroundColor = post.color;
        
        // Date parsing helper
        const date = post.createdAt ? new Date(post.createdAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit' }) : '';
        const author = post.author || '익명';
        const strippedContent = post.content.replace(/<[^>]*>?/gm, ''); // stripped html

        // Tag Generation
        let statusTag = '';
        if (post.status === 'important') statusTag = '<span class="status-pill pill-important"><i class="fas fa-star"></i> 중요</span>';
        if (post.status === 'urgent') statusTag = '<span class="status-pill pill-urgent"><i class="fas fa-exclamation-circle"></i> 긴급</span>';

        item.innerHTML = `
            <div class="notice-header-row">
                <div class="notice-profile-wrapper">
                    <span class="notice-author">${author}</span>
                    ${statusTag}
                </div>
                <span class="notice-date">${date}</span>
                <div class="notice-actions">
                    <button class="notice-action-btn copy" title="복사" onclick="event.stopPropagation(); window.copyBoardPost('${post.id}', this)"><i class="fas fa-copy"></i></button>
                    <button class="notice-action-btn delete" title="삭제" onclick="event.stopPropagation(); window.deleteBoardPost('${post.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="notice-content-preview">
                ${strippedContent}
            </div>
            <div class="notice-footer-row">
                <div class="notice-meta-info">
                   ${post.fileUrl ? `<span class="notice-meta-item"><i class="fas fa-paperclip"></i> 파일</span>` : ''}
                   ${(post.comments && post.comments.length > 0) ? `<span class="notice-meta-item"><i class="fas fa-comment"></i> ${post.comments.length}</span>` : ''}
                </div>
            </div>
        `;
        
        // Click to view/edit
        item.onclick = (e) => {
             // Avoid triggering if clicking actions (handled by stopPropagation, but safe guard)
             if (e.target.closest('.notice-action-btn')) return;
             window.editBoardPost(post.id);
        };
        
        list.appendChild(item);
      });
    };

    // 5. Modal Controls
    const openAddModal = () => {
      form.reset();
      editor.innerHTML = '';
      selectedFile = null;
      filePreview.classList.add('hidden');
      fileDropZone.classList.remove('hidden');
      document.getElementById('post-id').value = '';
      document.getElementById('boardModalTitle').textContent = '메모 작성';
      
      selectedAuthorInput.value = '교장';
      renderAuthorChips();
      customAuthorInput.style.display = 'none';
      customAuthorInput.value = '';

      selectedColor = '#fff9c4';
      colorTrigger.style.backgroundColor = selectedColor;
      colorOptions.forEach(o => {
          if(o.dataset.color === selectedColor) o.classList.add('selected');
          else o.classList.remove('selected');
      });

      modal.classList.add('active');
    };

    if (addPostBtn) {
      addPostBtn.onclick = openAddModal;
    }

    closeModalBtns.forEach(btn => {
      btn.onclick = () => modal.classList.remove('active');
    });

    // 6. Save Post
    form.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('post-id').value;
      const content = editor.innerHTML.trim();
      
      let author = selectedAuthorInput.value;
      if (author === '직접 입력') {
          author = customAuthorInput.value.trim() || '익명';
      }

      const status = document.querySelector('input[name="post-status"]:checked').value;
      
      if (!content || content === '<br>') {
          alert('내용을 입력해 주세요.');
          return;
      }

      const { db, firestoreUtils, storage, storageUtils } = window;
      try {
        let fileUrl = null;
        let fileName = null;

        if (selectedFile) {
            const fileRef = storageUtils.ref(storage, `boardFiles/${Date.now()}_${selectedFile.name}`);
            const uploadSnap = await storageUtils.uploadBytes(fileRef, selectedFile);
            fileUrl = await storageUtils.getDownloadURL(uploadSnap.ref);
            fileName = selectedFile.name;
        }

        const postData = {
          content,
          author,
          status,
          color: selectedColor,
          updatedAt: new Date().toISOString()
        };

        if (fileUrl) {
            postData.fileUrl = fileUrl;
            postData.fileName = fileName;
        }

        if (id) {
          await firestoreUtils.setDoc(firestoreUtils.doc(db, "boardPosts", id), postData, { merge: true });
        } else {
          postData.createdAt = new Date().toISOString();
          postData.comments = [];
          
          const currentPostsSnap = await firestoreUtils.getDocs(firestoreUtils.collection(db, "boardPosts"));
          postData.order = currentPostsSnap.size;
          
          const newDocRef = firestoreUtils.doc(firestoreUtils.collection(db, "boardPosts"));
          await firestoreUtils.setDoc(newDocRef, postData);
        }
        
        modal.classList.remove('active');
        loadBoard();
      } catch (err) {
        console.error("Board save error:", err);
        alert("저장 중 오류가 발생했습니다.");
      }
    };

    // Exposed Global Functions for dynamic HTML
    window.deleteBoardPost = async (id) => {
      if (!confirm('메모를 삭제하시겠습니까?')) return;
      const { db, firestoreUtils } = window;
      try {
        await firestoreUtils.deleteDoc(firestoreUtils.doc(db, "boardPosts", id));
        loadBoard();
      } catch (err) {
        console.error("Delete error:", err);
      }
    };

    window.editBoardPost = async (id) => {
      const { db, firestoreUtils } = window;
      try {
        const q = firestoreUtils.query(firestoreUtils.collection(db, "boardPosts"));
        const snap = await firestoreUtils.getDocs(q);
        let target = null;
        snap.forEach(d => { if(d.id === id) target = d.data(); });
        
        if (target) {
          document.getElementById('post-id').value = id;
          editor.innerHTML = target.content;
          
          if (authors.includes(target.author)) {
               selectedAuthorInput.value = target.author;
               customAuthorInput.style.display = 'none';
          } else {
               selectedAuthorInput.value = '직접 입력';
               customAuthorInput.style.display = 'block';
               customAuthorInput.value = target.author;
          }
          renderAuthorChips();
          
          const statusRadios = document.querySelectorAll('input[name="post-status"]');
          statusRadios.forEach(radio => {
            if (radio.value === (target.status || 'normal')) radio.checked = true;
          });

          selectedColor = target.color || '#fff9c4';
          colorTrigger.style.backgroundColor = selectedColor;
          colorOptions.forEach(o => {
              if(o.dataset.color === selectedColor) o.classList.add('selected');
              else o.classList.remove('selected');
          });

          document.getElementById('boardModalTitle').textContent = '메모 수정';
          modal.classList.add('active');
        }
      } catch (err) {}
    };

    window.addBoardComment = async (postId) => {
      const nameInput = document.getElementById(`comment-author-${postId}`);
      const textInput = document.getElementById(`comment-input-${postId}`);
      const author = nameInput.value.trim() || '익명';
      const text = textInput.value.trim();
      
      if (!text) return;

      const { db, firestoreUtils } = window;
      try {
          const docRef = firestoreUtils.doc(db, "boardPosts", postId);
          const snap = await firestoreUtils.getDocs(firestoreUtils.query(firestoreUtils.collection(db, "boardPosts")));
          let postData = null;
          snap.forEach(d => { if(d.id === postId) postData = d.data(); });

          if (postData) {
              const comments = postData.comments || [];
              comments.push({
                  author,
                  text,
                  createdAt: new Date().toISOString()
              });
              await firestoreUtils.setDoc(docRef, { comments }, { merge: true });
              textInput.value = '';
              loadBoard();
          }
      } catch (err) {
          console.error("Comment add error:", err);
      }
    };

    if (window.db) loadBoard();
    window.addEventListener('firebase-ready', loadBoard);
  }

  initNoticeBoard();

  // ================= Bus Request Section Logic (Spreadsheet Version) =================
  let localBusData = [];
  let busSortConfig = { field: 'date', direction: 'asc' }; // 정렬 설정

  async function initBus() {
    if (localBusData.length === 0) {
      await loadBusRequestsFromFirebase();
    } else {
      renderBusTable();
    }
    initBusEditing();
    initBusSorting(); // 정렬 리스너 초기화
  }

  async function loadBusRequestsFromFirebase() {
    if (!window.db) {
      localBusData = [];
      renderBusTable();
      return;
    }
    const { db, firestoreUtils } = window;
    try {
      const q = firestoreUtils.query(firestoreUtils.collection(db, "busRequests"));
      const querySnapshot = await firestoreUtils.getDocs(q);
      const loaded = [];
      querySnapshot.forEach(doc => {
        loaded.push({ id: doc.id, ...doc.data() });
      });
      
      localBusData = loaded;
      sortBusData(); // 초기 정렬 적용
      renderBusTable();
    } catch (err) {
      console.error("Bus load error:", err);
      renderBusTable();
    }
  }

  function sortBusData() {
    localBusData.sort((a, b) => {
      let valA, valB;

      if (busSortConfig.field === 'total') {
        valA = (parseInt(a.teacherCount) || 0) + (parseInt(a.studentCount) || 0);
        valB = (parseInt(b.teacherCount) || 0) + (parseInt(b.studentCount) || 0);
      } else {
        valA = a[busSortConfig.field] || "";
        valB = b[busSortConfig.field] || "";
        
        // 숫자형 데이터 처리
        if (['busCount', 'teacherCount', 'studentCount'].includes(busSortConfig.field)) {
          valA = parseInt(valA) || 0;
          valB = parseInt(valB) || 0;
        }
      }

      if (valA < valB) return busSortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return busSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function initBusSorting() {
    const headers = document.querySelectorAll("#bus-section .bus-table th[data-sort]");
    headers.forEach(header => {
      header.onclick = () => {
        const field = header.dataset.sort;
        if (busSortConfig.field === field) {
          busSortConfig.direction = busSortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
          busSortConfig.field = field;
          busSortConfig.direction = 'asc';
        }

        // UI 업데이트: 아이콘 변경
        headers.forEach(h => {
          h.classList.remove('active-sort');
          const icon = h.querySelector('i');
          if (icon) icon.className = 'fas fa-sort';
        });

        header.classList.add('active-sort');
        const currentIcon = header.querySelector('i');
        if (currentIcon) {
          currentIcon.className = busSortConfig.direction === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
        }

        sortBusData();
        renderBusTable();
      };
    });
  }

  function renderBusTable() {
    const tableBody = document.getElementById("bus-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    
    localBusData.forEach((req) => {
      const tr = document.createElement("tr");
      tr.dataset.id = req.id;
      
      const total = (parseInt(req.teacherCount) || 0) + (parseInt(req.studentCount) || 0);
      const isAccepted = req.isAccepted === true;
      const statusText = isAccepted ? '접수완료' : (req.status || '접수중');
      
      tr.innerHTML = `
        <td class="text-center">
            <input type="checkbox" class="bus-checkbox" ${isAccepted ? 'checked' : ''} 
                   onchange="window.toggleBusStatus('${req.id}', this.checked)">
        </td>
        <td class="text-center">
            <span class="badge-bus-status ${isAccepted ? 'completed' : 'pending'}" id="status-badge-${req.id}">
                ${statusText}
            </span>
        </td>
        <td class="text-center">${req.date}</td>
        <td class="text-center">${req.timeRange || ""}</td>
        <td class="text-center">${req.region || ""}</td>
        <td class="text-center">${req.busType || ""}</td>
        <td class="text-center">${req.busCount || ""}</td>
        <td>${req.destination || ""}</td>
        <td class="text-center">${req.useSchoolBus || ""}</td>
        <td class="text-center">${req.leadTeacher || ""}</td>
        <td class="text-center">${req.teacherCount || "0"}</td>
        <td class="text-center">${req.studentCount || "0"}</td>
        <td class="text-center"><span class="total-display">${total}</span></td>
        <td class="bus-purpose-cell">${req.purpose || ""}</td>
        <td class="text-center">
          <div class="bus-actions">
            <button class="btn-icon btn-edit-sm" onclick="window.openBusModal('${req.id}')" title="수정"><i class="fas fa-edit"></i></button>
            <button class="btn-icon btn-delete-sm" onclick="removeBusRow('${req.id}')" title="삭제"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  window.updateBusField = (id, field, value) => {
    const data = localBusData.find(r => r.id === id);
    if (data) data[field] = value;
  };

  window.updateBusTotal = (id, field, value) => {
    const data = localBusData.find(r => r.id === id);
    if (data) {
      data[field] = value;
      const total = (parseInt(data.teacherCount) || 0) + (parseInt(data.studentCount) || 0);
      const display = document.getElementById(`total-${id}`);
      if (display) display.textContent = total;
    }
  };

  window.toggleBusStatus = (id, isChecked) => {
    const data = localBusData.find(r => r.id === id);
    if (data) {
        data.isAccepted = isChecked;
        data.status = isChecked ? "접수완료" : "접수중";
        
        // Log action
        if(window.logUserAction) {
            window.logUserAction('bus', isChecked ? '접수' : '취소', `${data.date} ${data.destination}행 배차 ${data.status}`);
        }

        // Update UI Badge
        const badge = document.getElementById(`status-badge-${id}`);
        if (badge) {
            badge.textContent = data.status;
            badge.className = `badge-bus-status ${isChecked ? 'completed' : 'pending'}`;
        }
    }
  };

  function initBusEditing() {
    const busForm = document.getElementById("busForm");
    const busModal = document.getElementById("busModal");
    const closeBusModalBtns = document.querySelectorAll(".close-bus-modal");

    // Populate Time Selects
    const hours = Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0'));
    const mins = ['00', '10', '20', '30', '40', '50'];
    
    const hSelects = ['bus-start-hour', 'bus-end-hour'];
    const mSelects = ['bus-start-min', 'bus-end-min'];
    
    hSelects.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = hours.map(h => `<option value="${h}">${h}</option>`).join('');
    });
    mSelects.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = mins.map(m => `<option value="${m}">${m}</option>`).join('');
    });

    // Modal Close
    closeBusModalBtns.forEach(btn => {
      btn.onclick = () => busModal.classList.remove("active");
    });

    // Form Submit
    if (busForm) {
      busForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById("bus-id").value || "bus-" + Date.now();
        
        const sh = document.getElementById("bus-start-hour").value;
        const sm = document.getElementById("bus-start-min").value;
        const eh = document.getElementById("bus-end-hour").value;
        const em = document.getElementById("bus-end-min").value;
        
        const startTime = `${sh}:${sm}`;
        const endTime = `${eh}:${em}`;
        
        const newReq = {
          id: id,
          date: document.getElementById("bus-date").value,
          startTime: startTime,
          endTime: endTime,
          timeRange: `${startTime}~${endTime}`,
          region: document.getElementById("bus-region").value,
          busType: document.getElementById("bus-type").value,
          busCount: document.getElementById("bus-count").value,
          destination: document.getElementById("bus-destination").value,
          useSchoolBus: document.getElementById("bus-use-school").value,
          leadTeacher: document.getElementById("bus-teacher-name").value,
          teacherCount: document.getElementById("bus-teacher-count").value,
          studentCount: document.getElementById("bus-student-count").value,
          purpose: document.getElementById("bus-purpose").value,
          isAccepted: false,
          status: "접수중"
        };

        // Firebase 즉시 저장
        if (window.db) {
          const { db, firestoreUtils } = window;
          try {
            await firestoreUtils.setDoc(firestoreUtils.doc(db, "busRequests", id), newReq);
          } catch (err) {
            console.error("Save error:", err);
            alert("저장 중 오류가 발생했습니다.");
            return;
          }
        }

        const existingIdx = localBusData.findIndex(r => r.id === id);
        const actionType = existingIdx !== -1 ? '수정' : '신청';
        
        // Log action
        if(window.logUserAction) {
            window.logUserAction('bus', actionType, `${newReq.date} ${newReq.destination}행 배차 ${actionType}`);
        }

        if (existingIdx !== -1) {
            localBusData[existingIdx] = { ...localBusData[existingIdx], ...newReq };
        } else {
            localBusData.unshift(newReq);
        }

        busModal.classList.remove("active");
        renderBusTable();
      };
    }
  }

  window.openBusModal = (id = null) => {
    const modal = document.getElementById("busModal");
    const form = document.getElementById("busForm");
    const title = document.getElementById("busModalTitle");
    
    form.reset();
    document.getElementById("bus-id").value = id || "";
    
    if (id) {
      title.textContent = "배차 신청 수정";
      const data = localBusData.find(r => r.id === id);
      if (data) {
        document.getElementById("bus-date").value = data.date;
        
        if (data.startTime) {
          const [sh, sm] = data.startTime.split(':');
          document.getElementById("bus-start-hour").value = sh;
          document.getElementById("bus-start-min").value = sm;
        }
        if (data.endTime) {
          const [eh, em] = data.endTime.split(':');
          document.getElementById("bus-end-hour").value = eh;
          document.getElementById("bus-end-min").value = em;
        }

        document.getElementById("bus-region").value = data.region || "관내";
        document.getElementById("bus-type").value = data.busType || "중형(16~35인)";
        document.getElementById("bus-count").value = data.busCount || "1";
        document.getElementById("bus-destination").value = data.destination || "";
        document.getElementById("bus-use-school").value = data.useSchoolBus || "Y";
        document.getElementById("bus-teacher-name").value = data.leadTeacher || "";
        document.getElementById("bus-teacher-count").value = data.teacherCount || "0";
        document.getElementById("bus-student-count").value = data.studentCount || "0";
        document.getElementById("bus-purpose").value = data.purpose || "";
      }
    } else {
      title.textContent = "배차 신청";
      document.getElementById("bus-date").value = new Date().toISOString().split('T')[0];
      document.getElementById("bus-start-hour").value = "08";
      document.getElementById("bus-start-min").value = "30";
      document.getElementById("bus-end-hour").value = "16";
      document.getElementById("bus-end-min").value = "30";
    }
    
    modal.classList.add("active");
  };

  window.removeBusRow = async (id) => {
    if (confirm("해당 행을 삭제하시겠습니까?")) {
      const idx = localBusData.findIndex(r => r.id === id);
      if (idx !== -1) {
        const deletedData = localBusData[idx];
        if (window.db) {
          const { db, firestoreUtils } = window;
          try {
            await firestoreUtils.deleteDoc(firestoreUtils.doc(db, "busRequests", id));
          } catch (err) {
            console.error("Delete error:", err);
            alert("삭제 중 오류가 발생했습니다.");
            return;
          }
        }
        
        // Log action
        if(window.logUserAction) {
            window.logUserAction('bus', '삭제', `${deletedData.date} ${deletedData.destination}행 배차 삭제`);
        }

        localBusData.splice(idx, 1);
        renderBusTable();
      }
    }
  };

  window.addEventListener('firebase-ready', () => {
    if (currentCategory === "bus") loadBusRequestsFromFirebase();
  });

  // 사이트 제목 클릭 시 홈으로 이동
  const sideTitle = document.querySelector('.side-site-title');
  if (sideTitle) {
    sideTitle.addEventListener('click', () => {
      const homeBtn = document.querySelector('.nav-item[data-category="all"]');
      if (homeBtn) homeBtn.click();
    });
  }

  // --- Board Post Copy Function ---
  window.copyBoardPost = (id, element) => {
    const card = element.closest('.board-card');
    const content = card.querySelector('.card-text-content').innerText;
    
    navigator.clipboard.writeText(content).then(() => {
      // Visual feedback
      const originalIcon = element.innerHTML;
      if (element.tagName === 'BUTTON') {
        element.innerHTML = '<i class="fas fa-check"></i>';
        element.style.color = '#10b981';
      } else {
        // If text content was clicked
        const toast = document.createElement('div');
        toast.className = 'copy-toast';
        toast.textContent = '메모가 복사되었습니다.';
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('active'), 10);
        setTimeout(() => {
          toast.classList.remove('active');
          setTimeout(() => toast.remove(), 300);
        }, 2000);
      }
      
      if (element.tagName === 'BUTTON') {
        setTimeout(() => {
          element.innerHTML = originalIcon;
          element.style.color = '';
        }, 2000);
      }
    }).catch(err => {
      console.error('Copy failed', err);
    });
  };

  // --- Theme Toggle Logic ---
  const themeToggle = document.querySelector('#checkbox');
  const currentTheme = localStorage.getItem('theme');

  if (currentTheme === 'dark-mode') {
    document.body.classList.add('dark-mode');
    if (themeToggle) themeToggle.checked = true;
  }

  if (themeToggle) {
    themeToggle.addEventListener('change', function(e) {
      if (e.target.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light-mode');
      }
    });
  }

  // --- Header Scroll Effect ---
  const header = document.querySelector('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });
  // --- Mobile Swipe Navigation ---
  function initSwipeNavigation() {
    let touchStartX = 0;
    let touchStartY = 0;
    const threshold = 70; // min distance for swipe
    const maxVerticalOffset = 50; // max vertical distance to ignore scroll

    document.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      // Only for mobile
      if (window.innerWidth > 768) return;

      const touchEndX = e.changedTouches[0].screenX;
      const touchEndY = e.changedTouches[0].screenY;
      
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;

      // Check if it's horizontal swipe and not a vertical scroll
      if (Math.abs(diffX) > threshold && Math.abs(diffY) < maxVerticalOffset) {
        
        // Define tab order
        const tabs = Array.from(document.querySelectorAll('.nav-item'));
        const visibleTabs = tabs.filter(tab => {
             return getComputedStyle(tab).display !== 'none';
        });

        // Find current active index
        const currentIndex = visibleTabs.findIndex(tab => tab.classList.contains('active'));
        if (currentIndex === -1) return;

        if (diffX < 0) {
          // Swipe Left -> Next Tab (Drag finger left, content moves left, next item comes from right)
          if (currentIndex < visibleTabs.length - 1) {
            visibleTabs[currentIndex + 1].click();
          }
        } else {
          // Swipe Right -> Prev Tab
          if (currentIndex > 0) {
            visibleTabs[currentIndex - 1].click();
          }
        }
      }
    }, { passive: true });
  }

  initSwipeNavigation();

  // ============================================
  // LOGIN & REGISTER LOGIC (ADDED)
  // ============================================

  // 1. Firebase Initialize (Compat)
  const firebaseConfig = {
    apiKey: "AIzaSyCQmDCL-PuN2A9AgOzIpObCeNtvIFDJmhU",
    authDomain: "studio-8412089884-f8185.firebaseapp.com",
    projectId: "studio-8412089884-f8185",
    storageBucket: "studio-8412089884-f8185.firebasestorage.app",
    messagingSenderId: "928283224778",
    appId: "1:928283224778:web:01cb08827402140aace233"
  };

  let auth, db;

  try {
      // Wait for firebase script to load if not ready
      if (typeof firebase !== 'undefined') {
          if (!firebase.apps.length) {
              firebase.initializeApp(firebaseConfig);
          }
          auth = firebase.auth();
          db = firebase.firestore();
          
          window.auth = auth;
          window.db = db;
          
          // Compat Mapper for existing modular-style calls in script.js
          window.firestoreUtils = {
              collection: (d, n) => d.collection(n),
              doc: (d, c, i) => i ? d.collection(c).doc(i) : d, 
              getDocs: (q) => q.get(), 
              setDoc: (d, v) => d.set(v),
              updateDoc: (d, v) => d.update(v),
              deleteDoc: (d) => d.delete(),
              
              // Helper functions returning constraint objects
              orderBy: (field, dir) => ({ type: 'orderBy', field, dir }),
              limit: (n) => ({ type: 'limit', val: n }),
              where: (field, op, val) => ({ type: 'where', field, op, val }),
              
              // Query function applies constraints to the collection/query object
              query: (q, ...args) => {
                  let queryRef = q;
                  args.forEach(arg => {
                      if (arg.type === 'orderBy') queryRef = queryRef.orderBy(arg.field, arg.dir);
                      else if (arg.type === 'limit') queryRef = queryRef.limit(arg.val);
                      else if (arg.type === 'where') queryRef = queryRef.where(arg.field, arg.op, arg.val);
                  });
                  return queryRef;
              },
              
              onSnapshot: (q, cb) => q.onSnapshot(cb)
          };
          
          // Re-trigger init functions that depend on db
          window.dispatchEvent(new Event('firebase-ready'));
      }
  } catch (e) {
      console.error("Firebase Init Error:", e);
  }



  /* ============================================
     ADMIN PAGE ENHANCEMENTS (Stats, Logs, Bin)
     ============================================ */
  
  // 1. Admin Top Navigation & View Switching
  window.switchAdminView = (viewId) => {
    // Updated selector for new top menu buttons
    const navItems = document.querySelectorAll('.admin-nav-btn[data-view]');
    const views = document.querySelectorAll('.admin-view');
    const headerTitle = document.getElementById('admin-view-title');
    const headerDesc = document.getElementById('admin-view-desc');

    const viewInfo = {
      'dashboard': { title: '대시보드', desc: '관리자 현황 및 통계' },
      'users': { title: '교직원 현황', desc: '가입 승인 및 회원 정보 관리' },
      'logs': { title: '관리자 로그', desc: '관리자 및 시스템 활동 기록' },
      'user-logs': { title: '사용자 로그', desc: '사용자들의 주요 활동 내역' },
      'bin': { title: '휴지통', desc: '삭제된 회원 복구 및 영구 삭제' }
    };

    // Update Nav
    navItems.forEach(n => {
        if(n.dataset.view === viewId) n.classList.add('active');
        else n.classList.remove('active');
    });

    // Update View
    views.forEach(v => {
      v.classList.remove('active');
      if(v.id === `admin-view-${viewId}`) v.classList.add('active');
    });

    // Update Header
    if(headerTitle && viewInfo[viewId]) {
        headerTitle.textContent = viewInfo[viewId].title;
        headerDesc.textContent = viewInfo[viewId].desc;
    }

    // Trigger Data Load needed for specific views
    if(viewId === 'dashboard') window.loadUserStats(); // New: Dashboard statistics
    if(viewId === 'logs') window.loadAdminLogs();
    if(viewId === 'user-logs') window.loadUserLogs();
    if(viewId === 'bin') window.loadRecycleBin();
  };

  window.initAdminNav = () => {
    // Initialize navigation clicks (if not inline onclick)
    // Currently using inline onclick="switchAdminView(...)" in HTML, so strictly not needed,
    // but good for clean initialization or if removed inline.
    // The previous implementation added listeners.
    const navItems = document.querySelectorAll('.admin-nav-btn[data-view]');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        window.switchAdminView(item.dataset.view);
      });
    });
  };

  window.downloadUserCSV = () => {
     // Retrieve adminUsers from somewhere or re-fetch?
     // adminUsers is in index.html module scope. We can't access it easily unless we expose it.
     // But wait, renderAdminTable uses it. 
     // We can try to access the table rows directly or fetch again.
     // Fetching again is safer.
     if(!db) return;
     
     // Ask for confirmation
     if(!confirm("전체 회원 명부를 CSV로 다운로드하시겠습니까? (개인정보 보호 주의)")) return;

     db.collection("users").orderBy("createdAt", "desc").get().then(snap => {
         let csv = "\uFEFF이름,이메일,소속,직위,담임여부(반),권한,가입일,상태\n";
         snap.forEach(doc => {
             const u = doc.data();
             if(u.deleted) return; // Skip deleted

             const classInfo = u.isHomeroom ? (u.classInfo || 'O') : 'X';
             const date = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '';
             const status = u.approved ? '승인' : '대기';
             
             // Escape commas
             const clean = (s) => (s || '').replace(/,/g, ' ');
             
             csv += `${clean(u.name)},${clean(u.email)},${clean(u.school)},${clean(u.position)},${clean(classInfo)},${u.role},${date},${status}\n`;
         });
         
         const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
         const link = document.createElement("a");
         const url = URL.createObjectURL(blob);
         link.setAttribute("href", url);
         link.setAttribute("download", `회원명부_${new Date().toLocaleDateString()}.csv`);
         link.style.visibility = 'hidden';
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         
         if(window.logAdminAction) window.logAdminAction("명부 다운로드", "전체 회원 명부 CSV 다운로드");
     });
  };

  // 2. Dashboard Statistics & Recent Logs Update
  window.updateAdminDashboard = (users) => {
      // Users is the list of ACTIVE users (not deleted)
      const total = users.length;
      const teachers = users.filter(u => u.position && (u.position.includes('교사') || u.position.includes('부장'))).length;
      const pending = users.filter(u => !u.approved).length;
      
      const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
      
      setTxt('stat-total-users', total);
      setTxt('stat-total-teachers', teachers);
      setTxt('stat-pending-users', pending);
      
      // Async fetch for deleted count
      if(db) {
         db.collection("users").where("deleted", "==", true).get()
         .then(snap => {
             setTxt('stat-deleted-users', snap.size);
         });

         // Fetch Recent Logs for Widget
         const logList = document.getElementById('dashboard-recent-logs');
         if(logList) {
             db.collection("adminLogs").orderBy('timestamp', 'desc').limit(5).get()
             .then(snap => {
                 if(snap.empty) {
                     logList.innerHTML = '<li class="empty-log">최근 활동이 없습니다.</li>';
                     return;
                 }
                 let html = '';
                 snap.forEach(doc => {
                     const log = doc.data();
                     const time = new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                     html += `
                        <li class="log-item">
                            <div class="log-icon"><i class="fas fa-history"></i></div>
                            <div class="log-content">
                                <span class="log-text"><strong>${log.admin}</strong>: ${log.details}</span>
                                <span class="log-time">${time}</span>
                            </div>
                        </li>
                     `;
                 });
                 logList.innerHTML = html;
             });
         }
      }
  };

  // 3. Activity Logging (Admin)
  window.logAdminAction = async (action, details) => {
      if(!db) return;
      const user = auth.currentUser;
      const adminName = user ? (user.displayName || user.email) : 'System';

      try {
          await db.collection("adminLogs").add({
              action: action,
              details: details,
              admin: adminName,
              timestamp: new Date().toISOString()
          });
      } catch(e) { console.error("Logging failed", e); }
  };

  // 3.1 User Activity Logging (New)
  window.logUserAction = async (category) => {
      if(!db || !auth.currentUser) return; // Only log logged-in users
      const user = auth.currentUser;
      const userName = user.displayName || user.email;
      const viewNames = {
          'all': '홈',
          'status': '학교현황',
          'account': '학교계정',
          'curriculum': '학사일정',
          'bus': '배차신청',
          'datayard': '자료마당',
          'support': '온학교 e지원',
          'admin': '관리자 페이지'
      };
      
      const actionName = viewNames[category] || category;

      try {
           await db.collection("userLogs").add({
              user: userName,
              uid: user.uid,
              action: '조회',
              target: actionName,
              timestamp: new Date().toISOString(),
              category: category
          });
      } catch(e) { console.error("User logging failed", e); }
  };

  // 4. Logs Viewer
  let adminLogsData = [];
  let adminLogsPage = 1;
  const logsPerPage = 10;

  window.loadAdminLogs = async function(page = 1) {
      const targetTbody = document.getElementById('admin-log-list');
      const pagination = document.getElementById('admin-log-pagination');
      if(!targetTbody) return;
      
      adminLogsPage = page;
      targetTbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</td></tr>';
      if(pagination) pagination.innerHTML = '';

      if(!db) {
          targetTbody.innerHTML = '<tr><td colspan="5" class="text-center">DB 연결 실패</td></tr>';
          return;
      }
      
      try {
          if (adminLogsData.length === 0 || page === 1) {
              const q = db.collection("adminLogs").orderBy('timestamp', 'desc').limit(200);
              const snap = await q.get();
              adminLogsData = [];
              snap.forEach(doc => adminLogsData.push(doc.data()));
          }
          
          if(adminLogsData.length === 0) {
              targetTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">기록된 로그가 없습니다.</td></tr>';
              return;
          }

          const totalPages = Math.ceil(adminLogsData.length / logsPerPage);
          const start = (page - 1) * logsPerPage;
          const end = start + logsPerPage;
          const paginatedLogs = adminLogsData.slice(start, end);

          let html = '';
          paginatedLogs.forEach(log => {
              const date = new Date(log.timestamp);
              const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
              
              let target = '-';
              if(log.details && log.details.includes('(')) {
                  const match = log.details.match(/([^(]+)\(([^)]+)\)/);
                  if(match) target = match[1].trim();
              }

              html += `
                <tr>
                    <td style="font-size: 0.85rem; color: #64748b;">${dateStr}</td>
                    <td style="font-weight: 600;">${log.admin || 'System'}</td>
                    <td><span class="badge" style="background: #e0e7ff; color: #4338ca;">${log.action}</span></td>
                    <td style="color: #475569;">${target}</td> 
                    <td style="text-align: left; color: #334155;">${log.details}</td>
                </tr>
              `;
          });
          targetTbody.innerHTML = html;
          renderPagination(pagination, totalPages, page, 'loadAdminLogs');

      } catch(e) {
          console.error("Logs Error:", e);
          targetTbody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">로그 로드 실패: ${e.message}</td></tr>`;
      }
  };

  let userLogsData = [];
  let userLogsPage = 1;

  window.loadUserLogs = async function(page = 1) {
      const targetTbody = document.getElementById('admin-user-log-list');
      const pagination = document.getElementById('admin-user-log-pagination');
      if(!targetTbody) return;
      
      userLogsPage = page;
      
      // Get filter values
      const startDate = document.getElementById('filter-user-log-start')?.value;
      const endDate = document.getElementById('filter-user-log-end')?.value;
      const filterName = document.getElementById('filter-user-log-name')?.value.trim().toLowerCase();
      const filterAction = document.getElementById('filter-user-log-action')?.value;
      const filterCategory = document.getElementById('filter-user-log-category')?.value;

      targetTbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</td></tr>';
      if(pagination) pagination.innerHTML = '';

      if(!window.db) {
          targetTbody.innerHTML = '<tr><td colspan="5" class="text-center">DB 연결 실패</td></tr>';
          return;
      }
      
      try {
          const { db, firestoreUtils } = window;
          
          if (userLogsData.length === 0 || page === 1) {
              let q = firestoreUtils.query(
                  firestoreUtils.collection(db, "userLogs"),
                  firestoreUtils.orderBy('timestamp', 'desc'),
                  firestoreUtils.limit(500) 
              );
              
              const snap = await firestoreUtils.getDocs(q);
              userLogsData = [];
              snap.forEach(doc => userLogsData.push({ id: doc.id, ...doc.data() }));
          }

          // Client-side Filtering
          let filteredLogs = userLogsData.filter(log => {
              if (startDate) {
                  const s = new Date(startDate + "T00:00:00");
                  if (new Date(log.timestamp) < s) return false;
              }
              if (endDate) {
                  const e = new Date(endDate + "T23:59:59");
                  if (new Date(log.timestamp) > e) return false;
              }
              if (filterName && !log.user?.toLowerCase().includes(filterName)) return false;
              if (filterAction && log.action !== filterAction) return false;
              if (filterCategory && log.category !== filterCategory) return false;
              return true;
          });

          if(filteredLogs.length === 0) {
              targetTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">필터 결과에 해당하는 로그가 없습니다.</td></tr>';
              return;
          }

          const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
          const start = (page - 1) * logsPerPage;
          const end = start + logsPerPage;
          const paginatedLogs = filteredLogs.slice(start, end);

          let html = '';
          paginatedLogs.forEach(log => {
              const date = new Date(log.timestamp);
              const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
              
              let actionClass = 'badge-blue';
              if (['삭제', '취소'].includes(log.action)) actionClass = 'badge-red';
              else if (['생성', '신청', '접수'].includes(log.action)) actionClass = 'badge-green';
              else if (['수정', '이동'].includes(log.action)) actionClass = 'badge-orange';
              
              const detailsHtml = log.details ? `<div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">${log.details}</div>` : '';
              const catName = log.category || '-'; // Define catName here

              html += `
                <tr>
                    <td style="font-size: 0.85rem; color: #64748b;">${dateStr}</td>
                    <td style="font-weight: 600;">${log.user || 'Unknown'}</td>
                    <td><span class="badge ${actionClass}">${log.action}</span></td>
                    <td style="color: #475569;">
                        ${log.target || '-'}
                        ${detailsHtml}
                    </td> 
                    <td style="text-align: left; color: #334155;">${catName}</td>
                </tr>
              `;
          });
          targetTbody.innerHTML = html;
          renderPagination(pagination, totalPages, page, 'loadUserLogs');

      } catch(e) {
          console.error("User Logs Error:", e);
          targetTbody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">로그 로드 실패: ${e.message}</td></tr>`;
      }
  };

  function renderPagination(container, totalPages, currentPage, callbackName) {
      if(!container || totalPages <= 1) return;
      
      let html = '';
      // Prev
      html += `<button onclick="${callbackName}(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
      
      // Page numbers (Simple logic: show max 5 surrounding current)
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, start + 4);
      if (end - start < 4) start = Math.max(1, end - 4);

      for(let i = start; i <= end; i++) {
          html += `<button class="${i === currentPage ? 'active' : ''}" onclick="${callbackName}(${i})">${i}</button>`;
      }
      
      // Next
      html += `<button onclick="${callbackName}(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
      
      container.innerHTML = html;
  }

  window.resetUserLogFilters = function() {
      if(document.getElementById('filter-user-log-start')) document.getElementById('filter-user-log-start').value = '';
      if(document.getElementById('filter-user-log-end')) document.getElementById('filter-user-log-end').value = '';
      if(document.getElementById('filter-user-log-name')) document.getElementById('filter-user-log-name').value = '';
      if(document.getElementById('filter-user-log-action')) document.getElementById('filter-user-log-action').value = '';
      if(document.getElementById('filter-user-log-category')) document.getElementById('filter-user-log-category').value = '';
      window.loadUserLogs();
  };

  // 5. Recycle Bin (Deleted Users)
  window.loadRecycleBin = async function() {
      // index.html has id="admin-bin-list"
      const tbody = document.getElementById('admin-bin-list');
      if(!tbody) return;
      
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</td></tr>';

      if(!db) return;
      
      try {
          const snap = await db.collection("users").where("deleted", "==", true).get();
          
          if(snap.empty) {
              tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">휴지통이 비었습니다.</td></tr>';
              return;
          }

          let html = '';
          snap.forEach(docSnap => {
              const u = docSnap.data();
              if(!u) return;

              html += `
                <tr>
                    <td>${u.deletedAt ? new Date(u.deletedAt).toLocaleDateString() : '-'}</td>
                    <td>${u.name || '이름 없음'}</td>
                    <td>${u.email || '-'}</td>
                    <td><span class="badge badge-position">${u.position || '-'}</span></td>
                    <td><span class="badge badge-red">삭제됨</span></td>
                    <td>
                        <div class="action-btn-group">
                            <button class="btn-icon btn-restore-sm" onclick="restoreUser('${docSnap.id}', '${u.name}')" title="복구">
                                <i class="fas fa-trash-restore"></i>
                            </button>
                            <button class="btn-icon btn-reject-sm" onclick="permanentDeleteUser('${docSnap.id}', '${u.name}')" title="영구 삭제">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </td>
                </tr>
              `;
          });
          tbody.innerHTML = html;
      } catch(e) {
          console.error(e);
          tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500">로드 실패: ${e.message}</td></tr>`;
      }
  };

  // 6. User Management Actions (Soft Delete & Restore)
  window.softDeleteUser = async (uid, name) => {
      if(!confirm(`[${name}] 회원을 삭제하시겠습니까?\n휴지통으로 이동되며 복구할 수 있습니다.`)) return;
      if(!db) return;
      
      try {
          await db.collection("users").doc(uid).update({
              deleted: true,
              deletedAt: new Date().toISOString(),
              approved: false
          });
          window.logAdminAction('회원 삭제', `${name} (${uid}) 회원을 휴지통으로 이동`);
          alert('휴지통으로 이동되었습니다.');
          // UI update is handled by onSnapshot in index.html (it removes it from main list)
          // Dashboard numbers update automatically via onSnapshot -> loadAdminData -> updateAdminDashboard
      } catch(e) {
          alert("삭제 실패: " + e.message);
      }
  };

  window.restoreUser = async (uid, name) => {
      if(!confirm(`[${name}] 회원을 복구하시겠습니까?`)) return;
      if(!db) return;
      
      try {
          await db.collection("users").doc(uid).update({
              deleted: false,
              deletedAt: null,
              approved: true // Restore as approved for convenience
          });
          window.logAdminAction('회원 복구', `${name} (${uid}) 회원 복구`);
          loadRecycleBin(); 
      } catch(e) {
          alert("복구 실패: " + e.message);
      }
  };

  window.permanentDeleteUser = async (uid, name) => {
     if(!confirm(`[${name}] 회원을 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다!`)) return;
     if(!db) return;

     try {
         await db.collection("users").doc(uid).delete();
         window.logAdminAction('영구 삭제', `${name} (${uid}) 회원 영구 삭제`);
         loadRecycleBin();
     } catch(e) {
         alert("삭제 실패: " + e.message);
     }
  };

  // Initialize Admin Nav on Load
  window.initAdminNav();

  // === 7. User Activity Statistics Logic (New) ===
  let statsChart = null;
  let statsData = []; // Aggregated data [{label, count, rawDate}]
  let currentStatsPeriod = 'daily'; // daily, weekly, monthly

  // Set default dates: Last 1 month
  const initStatsDates = () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    
    const startEl = document.getElementById('stats-start-date');
    const endEl = document.getElementById('stats-end-date');
    if(startEl) startEl.value = start.toISOString().split('T')[0];
    if(endEl) endEl.value = end.toISOString().split('T')[0];
  };

  window.loadUserStats = async function() {
    if(!window.db) return;
    const { db, firestoreUtils } = window;
    
    // Check if dates are set
    const sEl = document.getElementById('stats-start-date');
    if(sEl && !sEl.value) initStatsDates();

    const startDate = document.getElementById('stats-start-date').value;
    const endDate = document.getElementById('stats-end-date').value;

    try {
        // Query userLogs for the period
        // For efficiency, we query by timestamp. 
        // Note: Missing index might cause error, fallback handled by getting last 1000 logs if needed.
        let q = firestoreUtils.query(
            firestoreUtils.collection(db, "userLogs"),
            firestoreUtils.where("timestamp", ">=", startDate + "T00:00:00"),
            firestoreUtils.where("timestamp", "<=", endDate + "T23:59:59"),
            firestoreUtils.orderBy("timestamp", "asc")
        );
        
        let snap;
        try {
            snap = await firestoreUtils.getDocs(q);
        } catch (e) {
            console.warn("Stats Index error, falling back to limited fetch", e);
            q = firestoreUtils.query(firestoreUtils.collection(db, "userLogs"), firestoreUtils.limit(2000));
            snap = await firestoreUtils.getDocs(q);
        }

        const logs = [];
        snap.forEach(doc => logs.push(doc.data()));
        
        processStatsData(logs, startDate, endDate);
        renderUserStatsChart();
        renderUserStatsTable();
    } catch (e) {
        console.error("Stats load failed", e);
    }
  };

  function processStatsData(logs, start, end) {
    const periodData = {};
    const s = new Date(start);
    const e = new Date(end);
    let prevYear = null;

    let curr = new Date(s);
    while (curr <= e) {
        let key = "";
        if (currentStatsPeriod === 'daily') {
            key = (curr.getMonth() + 1).toString().padStart(2, '0') + "." + curr.getDate().toString().padStart(2, '0');
        } else if (currentStatsPeriod === 'weekly') {
            // '2월 1주' format
            const month = curr.getMonth() + 1;
            const weekNum = getWeekOfMonth(curr);
            key = month + "월 " + weekNum + "주";
        } else {
            // Smart monthly format: '2026년 1월', then '2월', then '2027년 1월'
            const year = curr.getFullYear();
            const month = curr.getMonth() + 1;
            
            if (prevYear === null || (year !== prevYear && month === 1)) {
                key = year + "년 " + month + "월";
            } else {
                key = month + "월";
            }
            prevYear = year;
        }
        if (!periodData[key]) periodData[key] = new Set();
        
        if (currentStatsPeriod === 'daily') curr.setDate(curr.getDate() + 1);
        else if (currentStatsPeriod === 'weekly') curr.setDate(curr.getDate() + 7);
        else curr.setMonth(curr.getMonth() + 1);
    }

    logs.forEach(log => {
        const d = new Date(log.timestamp);
        if (d < s || d > new Date(end + "T23:59:59")) return;

        let key = "";
        if (currentStatsPeriod === 'daily') {
            key = (d.getMonth() + 1).toString().padStart(2, '0') + "." + d.getDate().toString().padStart(2, '0');
        } else if (currentStatsPeriod === 'weekly') {
            key = (d.getMonth() + 1) + "월 " + getWeekOfMonth(d) + "주";
        } else {
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            // We need to find the correct key that was created in the initialization loop
            // The logic must match exactly how we built periodData keys
            // Re-running the logic is tricky due to prevYear, so we use a simpler approach
             key = month + "월";
             if (month === 1 || Object.keys(periodData).find(k => k.includes(year + "년") && k.includes(month + "월"))) {
                 const fullKey = year + "년 " + month + "월";
                 if(periodData[fullKey]) key = fullKey;
             }
        }
        
        if (periodData[key]) periodData[key].add(log.uid || log.user);
    });

    statsData = Object.keys(periodData).map(key => ({
        label: key,
        count: periodData[key].size
    }));
  }

  function getWeekOfMonth(date) {
    const day = date.getDate();
    return Math.ceil(day / 7);
  }

  function renderUserStatsChart() {
    const ctx = document.getElementById('userStatsChart');
    if(!ctx) return;

    const innerContainer = ctx.closest('.stats-chart-scroll-inner');
    const wrapper = innerContainer?.parentElement;
    
    if (innerContainer && wrapper) {
        // Point width 20px for high density as requested
        const pointWidth = 20; 
        const minWidth = wrapper.clientWidth - 5;
        const totalContentWidth = statsData.length * pointWidth;
        const finalWidth = Math.max(minWidth, totalContentWidth);
        innerContainer.style.width = finalWidth + 'px';
    }

    const data = {
        labels: statsData.map(d => d.label),
        datasets: [{
            label: '액티브 유저 수',
            data: statsData.map(d => d.count),
            borderColor: '#3b82f6',
            backgroundColor: (context) => {
                const chart = context.chart;
                const {ctx, chartArea} = chart;
                if (!chartArea) return null;
                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                gradient.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
                gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
                return gradient;
            },
            borderWidth: 2,
            tension: 0, // Sharp jagged peaks for professional "activity" look
            fill: true,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#3b82f6',
            pointBorderWidth: 1.5,
            pointRadius: statsData.length > 50 ? 0 : 2, // Hide points if very dense
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#3b82f6'
        }]
    };

    if (statsChart) statsChart.destroy();
    
    statsChart = new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { left: 5, right: 30, top: 10, bottom: 5 }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    padding: 10,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { size: 12, weight: '700' },
                    bodyFont: { size: 11 },
                    displayColors: false,
                    callbacks: {
                        label: (context) => ` 활동: ${context.parsed.y}명`
                    }
                }
            },
            scales: {
                x: {
                    grid: { 
                        display: true,
                        color: 'rgba(226, 232, 240, 0.3)',
                        drawTicks: false
                    },
                    border: { display: false },
                    ticks: { 
                        color: '#94a3b8', 
                        font: { size: 9 },
                        maxRotation: 0,
                        autoSkip: true,
                        autoSkipPadding: 30, // Show labels every ~120px spaces
                        maxTicksLimit: 20
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { 
                        color: 'rgba(226, 232, 240, 0.5)',
                        drawTicks: false,
                        lineWidth: 1
                    },
                    border: { display: false },
                    suggestedMax: Math.max(...statsData.map(d => d.count)) + 2,
                    ticks: { 
                        stepSize: 1, 
                        color: '#94a3b8', 
                        font: { size: 10 },
                        padding: 10
                    }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });

    // Smart Scroll: latest data
    setTimeout(() => {
        if (wrapper) {
            wrapper.scrollTo({ left: wrapper.scrollWidth, behavior: 'auto' });
        }
    }, 50);
  }

  function renderUserStatsTable() {
    const head = document.getElementById('stats-table-head');
    const body = document.getElementById('stats-table-body');
    if(!head || !body) return;

    head.innerHTML = `<tr>${statsData.map(d => `<th>${d.label}</th>`).join('')}</tr>`;
    body.innerHTML = `<tr>${statsData.map(d => `<td>${d.count}</td>`).join('')}</tr>`;
  }

  window.updateStatsPeriod = function(period, btn) {
    currentStatsPeriod = period;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    window.loadUserStats();
  };

  window.updateStatsFromSelect = function() {
    const months = parseInt(document.getElementById('stats-month-select').value);
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    
    document.getElementById('stats-start-date').value = start.toISOString().split('T')[0];
    document.getElementById('stats-end-date').value = end.toISOString().split('T')[0];
    window.loadUserStats();
  };

  window.updateStatsFromDate = function() {
    window.loadUserStats();
  };

  window.downloadStatsExcel = function() {
    if(!statsData || statsData.length === 0) return;
    
    // Convert to Excel format
    const rows = [
        ["기간", "액티브 유저 수"],
        ...statsData.map(d => [d.label, d.count])
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ActiveUsers");
    
    const fileName = `ActiveUserStats_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // === 8. Robust File Download Helper (Bypasses Browser Previewers) ===
  window.forceDownload = async function(e, url, title) {
    if (e) e.preventDefault();
    
    // Log the action for statistics
    if (window.logUserAction) {
      window.logUserAction('datayard', '다운로드', title);
    }

    let downloadUrl = url;

    // A. Detect and Convert Google Drive 'view' Links to 'uc?export=download'
    if (url.includes('drive.google.com')) {
        const driveRegex = /\/file\/d\/(.+?)\/(view|edit|open)/;
        const match = url.match(driveRegex);
        if (match && match[1]) {
            downloadUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
        } else if (url.includes('id=')) {
            const idMatch = url.match(/id=([^&]+)/);
            if (idMatch) downloadUrl = `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
        }
    }

    // B. Attempt Blob-based download to bypass browser's built-in preview/PDF viewer
    try {
        const response = await fetch(downloadUrl);
        if (response.ok) {
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = title || 'download';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
            return;
        }
    } catch (err) {
        console.warn("Direct blob fetch failed (likely CORS), falling back to location-based download:", err);
    }

    // C. Fallback for non-CORS sources (Some browsers may still preview)
    window.location.href = downloadUrl;
  };

});
