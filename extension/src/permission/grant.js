const btn = document.getElementById("go");
const out = document.getElementById("out");

btn.addEventListener("click", async () => {
  out.textContent = "Requesting...";
  out.className = "out";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    out.textContent = "Granted. Close this tab and record from the popup.";
    out.className = "out ok";
    setTimeout(() => window.close(), 1500);
  } catch (e) {
    out.textContent = "Failed: " + (e && e.message ? e.message : String(e));
    out.className = "out err";
  }
});
