package site.scopelabs.fakecall;

import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

// Capacitor 기본 MainActivity를 대체한다(CI가 생성물 위에 덮어씀).
// - FakeCall 커스텀 플러그인 등록(AlarmManager + full-screen intent 예약)
// - 잠금화면 위 표시 + 화면 켜기(setShowWhenLocked/turnScreenOn) — 실제 통화 수신 연출
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(FakeCall.class);   // super.onCreate 전에 등록(Capacitor 규칙)
    super.onCreate(savedInstanceState);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true);   // 잠금화면 위로 액티비티 표시
      setTurnScreenOn(true);     // 꺼진 화면 깨우기
    }
  }
}
