# 페이크콜 — 안드로이드 네이티브 빌드 (Capacitor + GitHub Actions)

기존 웹앱(`app/`)을 **Capacitor로 감싸 안드로이드 APK로 빌드**한다.
설정한 시간이 지나면 **앱을 닫거나 화면을 꺼/잠가도 정확한 시각에 진동이 울리고 전체화면 수신화면**이 뜬다.

> 이 PC엔 빌드 도구(Node/JDK/Android SDK)가 없으므로, **빌드는 GitHub Actions(클라우드)에서** 수행한다. 로컬 설치 불필요.

---

## 빌드 방법 (GitHub Actions)

### 1. GitHub 저장소에 올리기
이 폴더(`fake-call-native`)를 GitHub 저장소에 push한다(이미 `git` 초기화·커밋됨). 예:
```bash
cd C:/Users/External/클로드실습/fake-call-native
git remote add origin https://github.com/<내계정>/fakecall-native.git
git push -u origin main
```
> git이 없으면 GitHub Desktop으로 폴더를 끌어다 올려도 된다.

### 2. 자동 빌드 → APK 내려받기
1. push하면 **Actions 탭**에서 "Build Android APK"가 자동 실행(약 3~6분).
2. 초록 체크된 실행 페이지 하단 **Artifacts → `fakecall-debug-apk`** 다운로드 → 압축 풀면 `app-debug.apk`.

### 3. 폰에 설치
- APK를 폰으로 전송 → 탭해 설치("출처를 알 수 없는 앱" 경고 시 허용). 디버그 서명이라 바로 설치된다.
- **새 빌드를 받았으면 기존 앱을 완전히 삭제하고 재설치한다** — 알림 채널의 진동 설정은 한 번 만들면 같은 앱에서 못 바꾸므로.

### 4. 권한 허용 (중요) — 설정 → 앱 → 페이크콜
화면 꺼짐/잠금 상태에서 제대로 울리려면 아래를 모두 켠다:
- **알림** 허용 (첫 실행 시 물어봄)
- **알람 및 리마인더** 허용
- **배터리 → 제한 없음(Unrestricted)** ← 삼성 등 OEM 절전이 앱을 재우는 걸 방지(가장 중요)
- (삼성) 설정 → 배터리 → 백그라운드 사용 제한 → **딥슬립/절전 앱 목록에서 페이크콜 제거**
- **전체 화면 알림** 허용 (Android 14+; 예약 시 앱이 이 설정 화면을 자동으로 띄워줌)
- **다른 앱 위에 표시** 허용 (예약 시 앱이 자동으로 띄워줌)

### 5. 사용
- 발신자 이름·번호 + 시간(5·10분 또는 1~120분) 설정 → **예약** → 화면 끄고 대기 → 설정 시각에 **연속 진동 + 수신화면** → 통화/거절.

---

## 동작 방식 (요약)
- **웹앱 코드 그대로 재사용** — `app/`이 Capacitor webDir. `src/nativeBridge.js`가 네이티브에서만 커스텀 플러그인 `FakeCall`을 호출(웹 브라우저에서는 no-op라 PWA 버전도 그대로 동작).
- **정시 발화**: `FakeCall.schedule({delayMs,…})` → 네이티브가 디바이스 시계로 절대시각 계산 후 **`AlarmManager.setAlarmClock`**(절전/Doze에서도 정확히 발화하는 최고 우선순위 알람)으로 예약.
  - ⚠️ 절대 epoch(큰 숫자)를 브리지로 직접 넘기면 정밀도가 깨져 즉시 발화하므로, **반드시 작은 "지연(ms)"만 전달**한다.
- **발화 시**: `CallAlarmReceiver` → `CallForegroundService`가 ① 시스템 진동기로 **연속 진동**(60초 또는 수락/거절 시 정지) ② 전체화면 수신화면(`MainActivity`, `showWhenLocked`) 표시 ③ full-screen intent 알림.
- 수락/거절 → JS `actions.*` → `FakeCall.cancel()`가 알람·진동·서비스 정리.

## 네이티브 파일 (`native-android/`, CI가 빌드에 주입)
- `FakeCall.java` — Capacitor 플러그인(예약/취소/launch 데이터 + 권한 안내)
- `CallAlarmReceiver.java` — 알람 수신 → 포그라운드 서비스 시작(실패 시 알림 폴백)
- `CallForegroundService.java` — 연속 진동 + 알림 + 화면 표시
- `MainActivity.java` — 잠금화면 위 표시 + 화면 점등 시도

## 빌드 산출물
- `android/`, `node_modules/`는 **CI가 생성**하므로 커밋 안 함(`.gitignore`). 저장소엔 `app/`, `native-android/`, `package.json`, `capacitor.config.json`, `.github/workflows/`만 있으면 된다.

## 알려진 한계
- **꺼진 화면의 자동 점등**은 안드로이드 14~16이 비(非)다이얼러 사이드로드 앱에 대해 OS 차원에서 제한한다. 기기/버전에 따라 화면이 자동으로 켜지지 않고 진동만 울릴 수 있으며, 그땐 화면을 켜면 수신화면이 떠 있다. (정시 발화·진동·수신화면 자체는 동작)
- 탭이 완전히 종료돼도 `setAlarmClock` 알람은 OS가 보관하므로 발화하지만, 일부 기기의 강한 절전에선 배터리 "제한 없음"이 필수.
