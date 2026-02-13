# 2026-02-11 개발 로그 및 중요 결정 사항

## 🚨 중요 기술적 결정 (절대 준수)

### 1. Firestore 문서 업데이트 규칙
- **문제점**: `setDoc(ref, data, { merge: true })` 사용 시 의도치 않게 문서가 대체되거나 일부 필드만 남고 삭제되는 치명적인 오류 발생.
- **해결책**: 부분 업데이트 시 **반드시 `updateDoc`을 사용**해야 함.
- **규칙**:
  - **문서 생성**: `setDoc` 사용 (ID 수동 생성 후)
  - **부분 수정**: `updateDoc` 사용 (예: 완료 여부 토글, 날짜 이동 등)
  - 절대 `merge: true` 옵션에 의존하지 말 것.

### 2. 문서 ID 생성 방식
- **문제점**: Firebase SDK 버전에 따라 `addDoc`이나 `doc(collection())` 자동 ID 생성이 불안정하거나 작동하지 않음.
- **해결책**: 수동 ID 생성 방식 사용.
- **코드 패턴**:
  ```javascript
  const newId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await setDoc(doc(db, "collection", newId), data);
  ```

### 3. 사용자 로그 (User Activity Log)
- **함수 시그니처 변경**:
  `window.logUserAction(category, action = '조회', detail = '')`
- **호출 패턴**:
  - 조회: `logUserAction('curriculum')`
  - 생성: `logUserAction('curriculum', '생성', '제목 일정 생성')`
  - 수정: `logUserAction('curriculum', '수정', '제목 일정 수정')`
  - 삭제: `logUserAction('curriculum', '삭제', '제목 일정 삭제')`
  - 이동: `logUserAction('curriculum', '이동', '제목 일정을 날짜로 이동')`
- **주의사항**: `updateEventField` 같은 내부 함수에서 로그를 남기지 말고, 이를 호출하는 상위 함수(예: 드래그 핸들러)에서 로그를 남겨 중복 기록을 방지할 것.

## 🛠️ 수정된 기능 목록

1. **처리할 공문 (To-do) 위젯**
   - 체크박스 클릭 시 사라지는 문제 해결 (`updateDoc` 적용)
   - 상태 보존 및 UI 동기화 정상화

2. **학사일정 데이터 안전성**
   - 일정 이동 시 다른 데이터가 삭제되는 치명적 버그 수정 (`updateDoc` 적용)
   - 데이터 무결성 검사 도구 (`check_database.html`) 제작
   - 데이터 백업 및 복구 도구 (`backup_restore.html`) 제작

3. **기능 오류 수정**
   - **일정 등록**: `addDoc` 제거 및 수동 ID 생성으로 수정
   - **일정 복제**: 동일하게 수동 ID 생성으로 수정

4. **로그 시스템 개선**
   - 모든 활동(생성, 수정, 삭제, 이동, 복제)이 정확한 액션 타입으로 기록되도록 수정

## ⚠️ 파일 버전 관리
브라우저 캐시 문제로 기능이 동작하지 않을 경우:
- `index.html`의 스크립트 태그에 타임스탬프(`?v=xx&t=yyyymmdd...`)를 업데이트하여 강제 새로고침 유도.
