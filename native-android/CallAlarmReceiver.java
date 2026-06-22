package site.scopelabs.fakecall;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

// 알람 발화 시: (1) 포그라운드 서비스 시작 시도(가장 강력) →
// 실패하면 (2) full-screen intent 알림 + 액티비티 직접 실행으로 폴백.
// 모든 위험 동작을 try/catch로 감싸 크래시·퇴보를 방지(최소한 알림은 항상 뜸).
public class CallAlarmReceiver extends BroadcastReceiver {

  private static final String CHANNEL_ID = "fakecall_fullscreen";
  private static final int NOTIF_ID = 4242;

  @Override
  public void onReceive(Context ctx, Intent intent) {
    String name = intent.getStringExtra("name");
    String number = intent.getStringExtra("number");

    // (1) 포그라운드 서비스 시작 시도 — 정확 알람 예외로 백그라운드 시작이 허용될 수 있음
    boolean fgsStarted = false;
    try {
      Intent svc = new Intent(ctx, CallForegroundService.class);
      svc.putExtra("name", name);
      svc.putExtra("number", number);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ctx.startForegroundService(svc);
      } else {
        ctx.startService(svc);
      }
      fgsStarted = true;
    } catch (Throwable t) {
      fgsStarted = false;
    }

    // (2) FGS가 안 되면 직접 알림 + 액티비티(기존 폴백 경로)
    if (!fgsStarted) {
      postNotificationAndLaunch(ctx, name, number);
    }
  }

  private void postNotificationAndLaunch(Context ctx, String name, String number) {
    String title = (name != null && !name.isEmpty()) ? name
        : (number != null && !number.isEmpty()) ? number : "알 수 없음";

    NotificationManager nm =
        (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel ch = new NotificationChannel(
          CHANNEL_ID, "전화 수신", NotificationManager.IMPORTANCE_HIGH);
      ch.enableVibration(true);
      ch.setVibrationPattern(new long[]{0, 500, 300, 500, 300});
      ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
      nm.createNotificationChannel(ch);
    }

    Intent full = new Intent(ctx, MainActivity.class);
    // SINGLE_TOP 제외 → 매 알람마다 액티비티 새로 생성(onCreate)시켜 화면 켜기 재발동
    full.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
        | Intent.FLAG_ACTIVITY_CLEAR_TOP
        | Intent.FLAG_ACTIVITY_CLEAR_TASK);
    full.putExtra("fakecall_ringing", true);
    full.putExtra("name", name);
    full.putExtra("number", number);

    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_IMMUTABLE;
    PendingIntent fsPi = PendingIntent.getActivity(ctx, 1, full, flags);

    NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.sym_call_incoming)
        .setContentTitle(title)
        .setContentText("전화가 왔습니다 — 탭하여 받기")
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setFullScreenIntent(fsPi, true)
        .setContentIntent(fsPi)
        .setAutoCancel(true)
        .setOngoing(true);

    try { nm.notify(NOTIF_ID, b.build()); } catch (Throwable t) { /* ignore */ }
    try { ctx.startActivity(full); } catch (Throwable t) { /* 알림으로 폴백 */ }
  }
}
