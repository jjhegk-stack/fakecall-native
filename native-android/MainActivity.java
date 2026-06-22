package site.scopelabs.fakecall;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

// Capacitor 기본 MainActivity를 대체한다(CI가 생성물 위에 덮어씀).
// - FakeCall 커스텀 플러그인 등록(AlarmManager + full-screen intent 예약)
// - 잠금화면 위 표시 + 꺼진 화면 강제 점등(실제 통화 수신 연출)
public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(FakeCall.class);   // super.onCreate 전에 등록(Capacitor 규칙)
    super.onCreate(savedInstanceState);
    showOverLockAndWake();
  }

  // 이미 실행 중일 때 알람 인텐트로 다시 들어오는 경우도 처리
  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);   // getLaunchData가 최신 인텐트를 읽도록
    showOverLockAndWake();
  }

  // 잠금화면 위 표시 + 화면 강제 점등
  private void showOverLockAndWake() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true);
      setTurnScreenOn(true);
    }
    getWindow().addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
      | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
      | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);

    // 일부 기기(삼성 등)에서 turnScreenOn 플래그만으로 디스플레이가 안 켜지는 경우 보강:
    // ACQUIRE_CAUSES_WAKEUP 웨이크락으로 화면을 강제 점등 후 자동 해제.
    try {
      PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
      if (pm != null) {
        @SuppressWarnings("deprecation")
        PowerManager.WakeLock wl = pm.newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK
          | PowerManager.ACQUIRE_CAUSES_WAKEUP
          | PowerManager.ON_AFTER_RELEASE,
          "fakecall:ring");
        wl.acquire(15000);   // 15초 후 자동 해제(누수 방지)
      }
    } catch (Exception e) { /* ignore */ }
  }
}
