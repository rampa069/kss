// A dumb package that will relay messages from webpage to remote storage
(function() {

  // This is quite a bit of work just to hide one instance variable
  var lock, unlock, isLocked;
  (function() {
    var a = false;
    lock = function() { a = true; }
    unlock = function() { a = false; }
    isLocked = function() { return a; }
  })();

  function addUrl(url) {
    var urlString = 'url ' + Util.normalizeUrl(url);
    if (!(urlString in localStorage)) {
      Util.set(urlString, 1);
      Util.inc('numUrls');
    }
  }

  function addDomain(domain) {
    var domainString = 'domain ' + domain;
    if (!(domainString in localStorage)) {
      Util.set(domainString, 1);
      Util.inc('numDomains');
    }
  }
  
  // Receives data, sends it off to a server for storage.
  // There is a browser-level lock on this function: only one instance
  // of this function can be called at a time.
  function createReceiveDataListener(port) {
    var receiveData = function(msg) {
      if (msg.event != 'keystrokes') return;
      if (isLocked()) {
        setTimeout(function(){ receiveData(msg); }, 250);
      } else {
        lock();
        addUrl(msg.url);
        addDomain(msg.domain);
        Util.storeData(msg);
        port.postMessage({ success : 1 });
        unlock();
      }
    };

    return receiveData;
  }

  chrome.tabs.onActiveChanged.addListener(function(tabId, attachInfo) {
    chrome.tabs.get(tabId, function(tab) {
      Util.storeData({
        'event' : 'tabSwitch',
        'newUrl' : tab.url,
        'timestamp' : (new Date()).getTime()
      });
    });
  });

  chrome.tabs.onCreated.addListener(function(tab) {
    Util.storeData({
      'event' : 'tabCreated',
      'isActive' : tab.active,
      'timestamp' : (new Date()).getTime()
    });
  });

  chrome.extension.onConnect.addListener(function(port) {
    if (port.name == "heron-data") {
      port.onMessage.addListener(createReceiveDataListener(port));
      port.onMessage.addListener(function(msg) {
        if (msg.event != 'unload' && msg.event != 'load') return;
        Util.storeData(msg);
      });
    }
  });

})();
