/**
 * Адаптер уведомления менеджера. Транспорт настраивается через
 * ORDER_NOTIFY_WEBHOOK_URL; без него уведомление честно считается
 * недоставленным, а сама заявка/заказ при этом сохраняется в БД
 * (notifyStatus = failed — доступно для повторной отправки).
 */
export async function notifyManager(subject: string): Promise<"sent" | "failed"> {
  const webhook = process.env.ORDER_NOTIFY_WEBHOOK_URL;
  if (!webhook) {
    console.log(`[notify] ${subject}: транспорт не настроен (ORDER_NOTIFY_WEBHOOK_URL)`);
    return "failed";
  }
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
