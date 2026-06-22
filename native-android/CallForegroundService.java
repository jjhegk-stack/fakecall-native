package site.scopelabs.fakecall;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import androidx.core.app.NotificationCompat;

// 알람 시 잠금화면 위 통화화면을 띄우는 가장 강력한 시도(포그라운드 서비스).
// 모든 위험 동작을 try/catch로 감싸 실패 시 알림만 남기고 안전 종료(크래시·퇴보 방지).
public class CallForegroundService extends Service {

  private static final String CHANNEL_ID = "fakecall_fullscreen";
  private static final int NOTIF_ID = 4242;
  private static final long RING_TIMEOUT_MS = 60000L;   // 60초 후 자동 종료(무응답)

  private Vibrator vibrator;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final Runnable autoStop = new Runnable() {
    @Override public void run() { stopSelf(); }
  };

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String name = intent != null ? intent.getStringExtra("name") : "";
    String number = intent != null ? intent.getStringExtra("number") : "";
    String title = (name != null && !name.isEmpty()) ? name
        : (number != null && !number.isEmpty()) ? number : "알 수 없음";

    Notification notif = buildNotification(title, name, number);

    // FGS 진입(반드시 빠르게 startForeground). 실패하면 알림만 띄우고 안전 종료.
    try {
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE);
      } else {
        startForeground(NOTIF_ID, notif);
      }
    } catch (Throwable t) {
      try {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(NOTIF_ID, notif);   // 폴백: 일반 알림
      } catch (Throwable ignored) {}
      stopSelf();
      return START_NOT_STICKY;
    }

    // 실제 전화처럼 연속 진동(화면 꺼져 있어도 계속). 60초 무응답 시 자동 종료.
    startVibration();
    handler.postDelayed(autoStop, RING_TIMEOUT_MS);

    // 화면 강제 점등
    try {
      PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
      if (pm != null) {
        @SuppressWarnings("deprecation")
        PowerManager.WakeLock wl = pm.newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK
          | PowerManager.ACQUIRE_CAUSES_WAKEUP
          | PowerManager.ON_AFTER_RELEASE, "fakecall:fgs");
        wl.acquire(15000);
      }
    } catch (Throwable t) { /* ignore */ }

    // 통화화면 직접 실행 시도(FGS 상태에서 + 오버레이 권한이면 백그라운드 실행 허용 가능)
    try {
      startActivity(callIntent(name, number));
    } catch (Throwable t) { /* full-screen intent 알림으로 폴백 */ }

    return START_NOT_STICKY;
  }

  private Intent callIntent(String name, String number) {
    Intent full = new Intent(this, MainActivity.class);
    full.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
        | Intent.FLAG_ACTIVITY_CLEAR_TOP
        | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    full.putExtra("fakecall_ringing", true);
    full.putExtra("name", name);
    full.putExtra("number", number);
    return full;
  }

  private Notification buildNotification(String title, String name, String number) {
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel ch = new NotificationChannel(
          CHANNEL_ID, "전화 수신", NotificationManager.IMPORTANCE_HIGH);
      ch.enableVibration(true);
      ch.setVibrationPattern(new long[]{0, 500, 300, 500, 300});
      ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
      nm.createNotificationChannel(ch);
    }
    int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) piFlags |= PendingIntent.FLAG_IMMUTABLE;
    PendingIntent fsPi = PendingIntent.getActivity(this, 1, callIntent(name, number), piFlags);
    return new NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.sym_call_incoming)
        .setContentTitle(title)
        .setContentText("전화가 왔습니다 — 탭하여 받기")
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setFullScreenIntent(fsPi, true)
        .setContentIntent(fsPi)
        .setOngoing(true)
        .setAutoCancel(true)
        .build();
  }

  // 시스템 진동기를 반복 패턴으로 돌려 '계속 울리는' 연출(화면 꺼져 있어도 동작)
  private void startVibration() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
        vibrator = vm != null ? vm.getDefaultVibrator() : null;
      } else {
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
      }
      if (vibrator == null) return;
      long[] pattern = {0, 700, 800};   // 진동 0.7s / 정지 0.8s 반복
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));   // repeat=0 → 무한 반복
      } else {
        vibrator.vibrate(pattern, 0);
      }
    } catch (Throwable t) { /* ignore */ }
  }

  @Override
  public void onDestroy() {
    handler.removeCallbacks(autoStop);
    try { if (vibrator != null) vibrator.cancel(); } catch (Throwable t) { /* ignore */ }
    super.onDestroy();
  }

  // Android 14+ shortService 타임아웃 시 안전 종료(미종료 시 크래시 방지)
  @Override
  public void onTimeout(int startId) {
    stopSelf();
  }

  @Override
  public IBinder onBind(Intent intent) { return null; }
}
