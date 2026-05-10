export function openGmailOAuthPopup(authorizeUrl) {
  return new Promise((resolve, reject) => {
    const popup = window.open(
      authorizeUrl,
      "connect-gmail",
      "width=520,height=720,menubar=no,toolbar=no,location=no,status=no",
    );

    if (!popup) {
      reject(
        new Error(
          "Connect Gmail failed: the OAuth popup was blocked by the browser. Please allow popups and try again.",
        ),
      );
      return;
    }

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Connect Gmail failed: the OAuth popup took too long. Please try again from Settings.",
        ),
      );
    }, 120000);

    const interval = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(
          new Error(
            "Connect Gmail was cancelled or the popup was closed before authorization finished.",
          ),
        );
      }
    }, 500);

    function onMessage(event) {
      const data = event.data;

      if (!data || typeof data !== "object") {
        return;
      }

      if (data.type === "gmail-oauth-success") {
        cleanup();
        resolve(data);
      }

      if (data.type === "gmail-oauth-error") {
        cleanup();
        reject(
          new Error(
            data.message ||
              "Connect Gmail failed during OAuth authorization.",
          ),
        );
      }
    }

    function cleanup() {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      window.removeEventListener("message", onMessage);

      try {
        if (popup && !popup.closed) {
          popup.close();
        }
      } catch {
        // Ignore popup close errors.
      }
    }

    window.addEventListener("message", onMessage);
  });
}