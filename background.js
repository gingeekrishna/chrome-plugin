// Open the side panel when the user clicks the toolbar icon.
// Called at service-worker startup so the behaviour is always registered.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);
