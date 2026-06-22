# 페이크콜 — 안드로이드 네이티브 빌드 (Capacitor + GitHub Actions)

기존 웹앱(`app/`)을 **Capacitor로 감싸 안드로이드 APK로 빌드**한다.
네이티브 알림 예약(`@capacitor/local-notifications`)으로 **앱을 닫거나 화면을 꺼/잠가도 설정 시각에 알림+진동**이 울리고, 알림을 탭하면 전체화면 수신화면이 뜬다.

> 이 PC엔 빌드 도구(Node/JDK/Android SDK)가 없으므로, **빌드는 GitHub Actions(클라우드)에서** 수행한다. 로컬 설치 불필요.

---

## 빌드 방법 (GitHub Actions)

### 1. GitHub 저장소 만들고 올리기
1. github.com에서 새 저장소 생성(예: `fakecall-native`, Private 가능).
2. 이 폴더(`fake-call-native`)를 그 저장소에 올린다. 터미널에서:
   ```bash
   cd C:/Users/External/클로드실습/fake-call-native
   git init
   git add .
   git commit -m "페이크콜 네이티브 초기"
   git branch -M main
   git remote add origin https://github.com/<내계정>/fakecall-native.git
   git push -u origin main
   ```
   > git이 없으면 GitHub Desktop(앱)으로 폴더를 끌어다 올려도 된다.

### 2. 자동 빌드 → APK 내려받기
1. 푸시하면 **Actions 탭**에서 "Build Android APK"가 자동 실행된다(약 3~6분).
   - 수동 실행: Actions 탭 → 워크플로 선택 → **Run workflow**.
2. 실행이 끝나면(초록 체크) 해당 실행 페이지 하단 **Artifacts → `fakecall-debug-apk`** 를 내려받는다.
3. 압축을 풀면 `app-debug.apk` 가 나온다.

### 3. 폰에 설치
1. `app-debug.apk` 를 안드로이드 폰으로 전송(메일/USB/드라이브 등).
2. 파일을 탭해 설치. "출처를 알 수 없는 앱" 경고가 나오면 **이 출처 허용**.
   (디버그 서명 APK라 바로 설치된다.)

### 4. 첫 실행 시 권한 허용 (중요)
- **알림 권한**: 처음 실행하면 알림 허용을 묻는다 → 허용.
- **정확한 알람 권한** (Android 12+): 설정 → 앱 → 페이크콜 → **알람 및 리마인더** → 허용.
  (이게 꺼져 있으면 정확한 시각이 아니라 지연될 수 있다.)
- 배터리 최적화: 더 정확하게 하려면 설정 → 앱 → 페이크콜 → 배터리 → **제한 없음**.

### 5. 테스트
- 발신자·시간(짧게 1분) 설정 → **예약** → **화면을 끄고** 기다린다 → 설정 시각에 **알림+진동** → 탭하면 전체화면 수신화면 → 통화/거절.

---

## 동작 방식 (요약)
- **웹앱 코드 그대로 재사용** — `app/`이 Capacitor의 webDir. `src/nativeBridge.js`가 네이티브에서만 `window.Capacitor.Plugins.LocalNotifications`로 알림을 예약/취소(웹 브라우저에서는 no-op라 PWA 버전도 그대로 동작).
- 예약 시 JS 타이머 + 네이티브 알림을 **이중**으로 건다. 앱이 떠 있으면 JS 타이머가, 꺼져 있으면 네이티브 알림이 울린다.
- 알림 탭 → `localNotificationActionPerformed` → 수신화면(ringing) 진입.

## 빌드 산출물/생성물
- `android/`, `node_modules/`는 **CI가 생성**하므로 커밋하지 않는다(`.gitignore` 처리). 저장소엔 `app/`, `package.json`, `capacitor.config.json`, `.github/workflows/`만 있으면 된다.

## 한계 (남은 2단계 작업)
- 지금 MVP는 알림이 울리고 **탭하면** 전체화면 수신화면이 뜬다. **탭 없이 잠금화면 위로 자동 풀스크린 팝업**(진짜 통화처럼)까지 하려면 안드로이드 **full-screen intent**(커스텀 네이티브 코드 + `USE_FULL_SCREEN_INTENT` 권한)가 추가로 필요하다. 필요하면 2단계로 구현한다.
