(function () {
  const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;

  function safeReturnTo(value, fallback) {
    const target = typeof value === "string" ? value : "";
    if (!target.startsWith("/")
        || target.startsWith("//")
        || target.includes("\\")
        || CONTROL_CHARACTERS.test(target)) {
      return fallback;
    }
    try {
      const resolved = new URL(target, window.location.origin);
      return resolved.origin === window.location.origin ? target : fallback;
    } catch {
      return fallback;
    }
  }

  window.kkrepoSafeReturnTo = safeReturnTo;
})();
