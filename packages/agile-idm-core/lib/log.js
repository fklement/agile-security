var log = null;
var silent = (process.env.DEBUG_IDM_CORE !== "1");

function getLog() {
  if (log) {
    return log;
  } else {
    log = {
      log: function (string) {
        if (!silent)
          console.log("log info in agile-idm-core: " + string);
      },
      debug: function (string) {
        if (!silent)
          console.log("debug info in agile-idm-core: " + string);
      },
    };
    return log;
  }
}
module.exports = getLog();
