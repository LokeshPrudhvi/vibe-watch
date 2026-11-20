/* Runs before first paint so the saved theme never flashes the wrong colours. */
(function () {
  var root = document.documentElement;
  try {
    var s = (JSON.parse(localStorage.getItem("vibe-settings") || "{}").state) || {};
    var theme = s.theme || "dark";
    if (theme === "system") theme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    root.dataset.theme = theme;
    root.dataset.liquid = s.liquidGlass === false ? "off" : "on";
    root.dataset.motion = s.motion || "normal";
  } catch (e) {
    root.dataset.theme = "dark";
  }
})();
