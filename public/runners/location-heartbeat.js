// Niyat — orqa fonda doimiy joylashuv yuborish
//
// Bu fayl @capacitor/background-runner tomonidan ALOHIDA JS kontekstda
// ishlatiladi. Asosiy ilovaga kirmaydi, faqat global API'lardan foydalanadi:
//   - CapacitorGeolocation (joriy koordinatani olish)
//   - CapacitorKV (token va apiBase'ni asosiy ilova bilan baham korish)
//   - fetch (HTTP)
//
// Hodisalar:
//   - 'setup'     — asosiy ilova auth token va apiBase'ni yuboradi (login paytida)
//   - 'heartbeat' — har 15 daqiqada Android tomonidan chaqiriladi (interval cap'da)

addEventListener("setup", (resolve, reject, args) => {
  try {
    if (args && typeof args.token === "string") {
      CapacitorKV.set("auth_token", args.token);
    }
    if (args && typeof args.apiBase === "string") {
      CapacitorKV.set("api_base", args.apiBase);
    }
    resolve();
  } catch (err) {
    reject(err);
  }
});

addEventListener("clear", (resolve) => {
  try {
    CapacitorKV.remove("auth_token");
    CapacitorKV.remove("api_base");
  } catch (e) {
    /* ignore */
  }
  resolve();
});

addEventListener("heartbeat", async (resolve, reject) => {
  try {
    var token = CapacitorKV.get("auth_token");
    var apiBase = CapacitorKV.get("api_base") || "";
    if (!token) {
      // Hali login qilmagan — jim'cha o'tib ketamiz
      resolve();
      return;
    }

    // Joriy joylashuvni olish (yangi GPS o'qishi)
    var pos = await CapacitorGeolocation.getCurrentPosition();
    if (!pos || typeof pos.latitude !== "number") {
      resolve();
      return;
    }

    var res = await fetch(apiBase + "/api/profile/location", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracyM: pos.accuracy || null,
      }),
    });

    if (!res.ok) {
      console.warn("[bg-heartbeat] HTTP " + res.status);
    }
    resolve();
  } catch (err) {
    console.warn("[bg-heartbeat] error", err);
    reject(err);
  }
});
