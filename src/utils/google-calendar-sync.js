const CLIENT_ID = '282957432666-6b0t3u7k2fub1f1fdlr418mnneeo4tks.apps.googleusercontent.com';
const API_KEY = 'AIzaSyAdvZ9cy__9fWBRfgTyEoBsa27O1Cp-FoU';

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar';

let gapiInited = false;
let gisInited = false;
let tokenClient;

// State for decoupled auth flow
// State for decoupled auth flow
let currentAuthAction = null; // 'full_sync', 'auto_sync', 'auto_delete'
let pendingData = null;


window.gapiLoaded = function() {
  gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: [DISCOVERY_DOC],
  });
  gapiInited = true;
  maybeEnableButtons();
}

window.gisLoaded = function() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: handleAuthCallback, 
  });
  gisInited = true;
  maybeEnableButtons();
}

async function handleAuthCallback(resp) {
    if (resp.error) {
        console.error("Auth Error:", resp);
        return;
    }

    // Route actions based on what triggered the auth
    if (currentAuthAction === 'full_sync') {
        await startSync();
    } else if (currentAuthAction === 'auto_sync' && pendingData) {
        await executeSingleSync(pendingData);
    } else if (currentAuthAction === 'auto_delete' && pendingData) {
        await executeSingleDelete(pendingData);
    }

    // Cleanup
    currentAuthAction = null;
    pendingData = null;
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    console.log('Google Calendar Sync Infrastructure - READY');
  }
}

function handleSyncClick() {
  console.log('Sync button clicked');
  
  if (CLIENT_ID === 'YOUR_CLIENT_ID' || API_KEY === 'YOUR_API_KEY') {
    alert('구글 API 설정이 불완전합니다.');
    return;
  }

  if (!gapiInited || !gisInited) {
    alert('구글 서비스 초기화 중입니다. 잠시 후 다시 시도해 주세요.');
    return;
  }

  // Set Action State
  currentAuthAction = 'full_sync';

  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({prompt: 'consent'});
  } else {
    tokenClient.requestAccessToken({prompt: ''});
  }
}

async function startSync() {
  try {
    const syncBtn = document.getElementById('curr-google-sync-btn');
    const originalText = syncBtn ? syncBtn.innerHTML : '';
    if(syncBtn) {
        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 구글 동기화...';
        syncBtn.disabled = true;
    }

    // 1. Get events
    // Filter only events from the "일정" (edu) column as requested by the user
    let rawEvents = window.combinedEvents || [];
    let eventsToSync = rawEvents.filter(ev => ev.eventType === 'edu');
    
    // If empty, check if we need to fetch or if it's really empty
    if (eventsToSync.length === 0 && rawEvents.length > 0) {
        console.log('No "edu" events found in combinedEvents. Total events available:', rawEvents.length);
    }

    if (eventsToSync.length === 0) {
        alert('"일정" 칸에 등록된 내용이 없습니다. 동기화할 데이터가 없습니다.');
        if(syncBtn) {
            syncBtn.innerHTML = originalText;
            syncBtn.disabled = false;
        }
        return;
    }

    console.log(`Syncing ${eventsToSync.length} "일정" events...`);

    // 2. Find or Create Calendar
    const calendarId = await getTargetCalendarId();
    if (!calendarId) {
        if(syncBtn) {
            syncBtn.innerHTML = originalText;
            syncBtn.disabled = false;
        }
        return; 
    }

    // 3. Upsert Events
    let successCount = 0;
    for (const ev of eventsToSync) {
        if(await upsertEventToGoogle(calendarId, ev)) {
            successCount++;
        }
    }

    alert(`동기화 완료! ${successCount}개의 일정이 반영되었습니다.`);
    
    // Update Button UI to indicate "Connected/Active" state
    if(syncBtn) {
        localStorage.setItem('isGoogleSynced', 'true'); // Persist state

        // Change icon and text to show active sync state
        syncBtn.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i> 동기화 중';
        syncBtn.classList.add('is-synced'); 
        syncBtn.disabled = false;
        syncBtn.title = "현재 구글 캘린더와 실시간 동기화 중입니다. 클릭하여 다시 전체 동기화할 수 있습니다.";
        syncBtn.style.borderColor = "#10b981"; // Optional: Green border
        syncBtn.style.color = "#047857";      // Optional: Dark green text
        syncBtn.style.backgroundColor = "#ecfdf5"; // Optional: Light green bg
    }

  } catch (err) {
    console.error('Google Sync Error:', err);
    alert('동기화 중 오류 발생: ' + (err.result?.error?.message || err.message || '알 수 없는 오류'));
    const syncBtn = document.getElementById('curr-google-sync-btn');
    if (syncBtn) {
        syncBtn.innerHTML = '<i class="fab fa-google"></i> 구글 동기화';
        syncBtn.disabled = false;
    }
  }
}

async function getTargetCalendarId() {
    try {
        const calendarsResp = await gapi.client.calendar.calendarList.list();
        const targetCal = calendarsResp.result.items.find(c => c.summary === '가로내 학사일정');
        
        if (targetCal) {
            return targetCal.id;
        } else {
            if (confirm('구글 캘린더에 "가로내 학사일정" 이라는 전용 달력을 생성하시겠습니까?\n(확인을 누르면 새 달력을 만들고, 취소를 누르면 기본 달력에 동기화합니다)')) {
                const createResp = await gapi.client.calendar.calendars.insert({
                    resource: { summary: '가로내 학사일정' }
                });
                return createResp.result.id;
            } else {
                 return null;
            }
        }
    } catch(e) {
        console.error("Error finding calendar:", e);
        throw e;
    }
}

async function upsertEventToGoogle(calendarId, ev) {
    try {
        const start = ev.start;
        let end = ev.end || ev.start;

        if (!start) {
            console.warn('Skipping event due to missing start date:', ev);
            return false;
        }

        const endDateObj = new Date(end);
        // Check if date is valid
        if (isNaN(endDateObj.getTime())) {
            console.warn('Skipping event due to invalid date format:', ev);
            return false;
        }

        const gResource = formatGoogleEvent(ev);

        const existing = await gapi.client.calendar.events.list({
            'calendarId': calendarId,
            'privateExtendedProperty': [`onschool_id=${ev.id}`]
        });

        if (existing.result.items && existing.result.items.length > 0) {
            await gapi.client.calendar.events.update({
                'calendarId': calendarId,
                'eventId': existing.result.items[0].id,
                'resource': gResource
            });
        } else {
            await gapi.client.calendar.events.insert({
                'calendarId': calendarId,
                'resource': gResource
            });
        }
        return true;
    } catch (e) {
        console.error('Error syncing individual event:', ev, e);
        return false;
    }
}

// Robust event attachment
function initGoogleSyncButton() {
    const btn = document.getElementById('curr-google-sync-btn');
    if (btn) {
        console.log('Sync button found, attaching handler');
        btn.onclick = handleSyncClick;

        // Restore State from LocalStorage
        if (localStorage.getItem('isGoogleSynced') === 'true') {
             btn.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i> 동기화 중';
             btn.classList.add('is-synced');
             btn.title = "현재 구글 캘린더와 실시간 동기화 중입니다.";
             btn.style.borderColor = "#10b981";
             btn.style.color = "#047857";
             btn.style.backgroundColor = "#ecfdf5";
        }
    } else {
        console.warn('Sync button NOT found via ID: curr-google-sync-btn');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGoogleSyncButton);
} else {
    initGoogleSyncButton();
}

/**
 * Auto-Sync Functions (Called from curriculum.js)
 */
window.syncEventToGoogle = async function(eventData) {
    // Only auto-sync 'edu' events
    if (eventData.eventType !== 'edu') return;

    // Check if gapi is ready
    if (!gapiInited || !gisInited) {
        console.log('Google Sync skipped: Not logged in or API not ready.');
        return;
    }

    try {
        // Check Token - Sync if token exists OR if user is marked as synced (Silent Auth)
        if (gapi.client.getToken()) {
             await executeSingleSync(eventData);
        } else if (localStorage.getItem('isGoogleSynced') === 'true') {
            console.log('User is synced but token missing. Attempting silent auth...');
            currentAuthAction = 'auto_sync';
            pendingData = eventData;
            tokenClient.requestAccessToken({prompt: ''}); // Silent
        } else {
            console.log('Google Sync skipped: No active token. User must sync manually first.');
        }

    } catch (err) {
        console.error('Auto-sync trigger failed:', err);
    }
};

window.deleteEventFromGoogle = async function(eventId) {
    if (!gapiInited || !gisInited) return;

    try {
        // ONLY delete if we already have a token OR is synced user.
        if (gapi.client.getToken()) {
            await executeSingleDelete(eventId);
        } else if (localStorage.getItem('isGoogleSynced') === 'true') {
            currentAuthAction = 'auto_delete';
            pendingData = eventId;
            tokenClient.requestAccessToken({prompt: ''}); // Silent
        } else {
             console.log('Google Delete skipped: No active token.');
        }
    } catch (err) {
        console.error('Auto-delete trigger failed:', err);
    }
};

async function executeSingleSync(eventData) {
    try {
        console.log('Auto-syncing event to Google:', eventData.title);
        
        // Custom background find logic to avoid prompt:
        let calendarId = 'primary';
        try {
            const calendarsResp = await gapi.client.calendar.calendarList.list();
            const targetCal = calendarsResp.result.items.find(c => c.summary === '가로내 학사일정');
            if (targetCal) calendarId = targetCal.id;
        } catch(e) { /* ignore */ }

        await upsertEventToGoogle(calendarId, eventData);
        console.log('Auto-sync success:', eventData.title);
        
        // Visual Feedback (Small Toast)
        if(window.showToast) window.showToast('구글 캘린더에 저장되었습니다.');
        
    } catch (err) {
        console.error('Auto-sync failed:', err);
    }
}

async function executeSingleDelete(eventId) {
    try {
        console.log('Auto-deleting event from Google:', eventId);
        let calendarId = 'primary';
        try {
            const calendarsResp = await gapi.client.calendar.calendarList.list();
            const targetCal = calendarsResp.result.items.find(c => c.summary === '가로내 학사일정');
            if (targetCal) calendarId = targetCal.id;
        } catch(e) { /* ignore */ }

        const existing = await gapi.client.calendar.events.list({
            'calendarId': calendarId,
            'privateExtendedProperty': [`onschool_id=${eventId}`]
        });

        if (existing.result.items && existing.result.items.length > 0) {
            await gapi.client.calendar.events.delete({
                'calendarId': calendarId,
                'eventId': existing.result.items[0].id
            });
            console.log('Event deleted from Google Calendar');
            if(window.showToast) window.showToast('구글 캘린더에서 삭제되었습니다.');
        }
    } catch (err) {
        console.error('Auto-delete failed:', err);
    }
}

/**
 * Helper to Format Event for Google
 * Handles "HH:mm ~ HH:mm" strings vs All Day
 */
function formatGoogleEvent(ev) {
    const gResource = {
        'summary': ev.title || '제목 없음',
        'description': `${ev.eventType || ''} | ${ev.description || ''}`.trim(),
        'extendedProperties': {
            'private': { 'onschool_id': String(ev.id || Date.now()) } 
        }
    };

    let isAllDay = true;
    let startTimeStr = '';
    let endTimeStr = '';

    // Check for explicit time pattern (HH:mm) in the time string
    // We infer "All Day" vs "Timed" based on the content of ev.time.
    // Events with formats like "1교시" or empty time will default to All Day.
    // Regex now handles optional spaces around colon e.g. "09 : 00"
    const hasTimePattern = ev.time && typeof ev.time === 'string' && /(\d{1,2})\s*:\s*(\d{2})/.test(ev.time);

    console.log(`[GoogleSync] Parsed '${ev.title}': Time='${ev.time}' -> HasPattern=${hasTimePattern}`);

    if (hasTimePattern) {
        // Find all HH:mm patterns
        const timeMatch = ev.time.match(/(\d{1,2})\s*:\s*(\d{2})/g);
        
        if (timeMatch && timeMatch.length >= 1) {
            isAllDay = false;
            
            // Helper to clean "09 : 00" -> "09:00"
            const cleanTime = (t) => t.replace(/\s+/g, '');

            startTimeStr = cleanTime(timeMatch[0]); // First HH:mm
            if (timeMatch.length >= 2) {
                endTimeStr = cleanTime(timeMatch[1]); // Second HH:mm
            } else {
                // If only start time exists "10:00", we set end time same as start
                endTimeStr = startTimeStr; 
            }
        }
    }

    // Base Date (YYYY-MM-DD)
    const baseDate = ev.start.split('T')[0];

    if (isAllDay) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + 1); // Google end date is exclusive
        gResource['start'] = { 'date': baseDate };
        gResource['end'] = { 'date': d.toISOString().split('T')[0] };
    } else {
        // Construct ISO strings with Timezone (Asia/Seoul)
        const startIso = `${baseDate}T${startTimeStr}:00`;
        let endIso = `${baseDate}T${endTimeStr}:00`;

        // If start == end (e.g. just "10:00"), add 1 hour
        if (startTimeStr === endTimeStr) {
             let [h, m] = startTimeStr.split(':').map(Number);
             h = h + 1;
             const hStr = h < 10 ? `0${h}` : `${h}`;
             const mStr = m < 10 ? `0${m}` : `${m}`;
             if (h > 23) {
                endIso = `${baseDate}T23:59:59`;
             } else {
                endIso = `${baseDate}T${hStr}:${mStr}:00`;
             }
        }
        
        gResource['start'] = { 'dateTime': startIso, 'timeZone': 'Asia/Seoul' };
        gResource['end'] = { 'dateTime': endIso, 'timeZone': 'Asia/Seoul' };
    }

    return gResource;
}
