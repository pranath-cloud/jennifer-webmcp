// WebMCP Universal Content Script Injection
(function() {
  if (window.__WEBMCP_EXTENSION_INJECTED__) return;
  window.__WEBMCP_EXTENSION_INJECTED__ = true;

  var script = document.createElement("script");
  script.src = "https://webmcp.tendrilsioservices.com/widget.js";
  script.defer = true;
  document.head.appendChild(script);

  chrome.runtime.onMessage.addListener(function(req, sender, sendResponse) {
    if (req.action === "open_webmcp_copilot") {
      var trigger = document.querySelector(".jmcp-trigger");
      if (trigger) trigger.click();
      sendResponse({ status: "opened" });
    }
  });
})();