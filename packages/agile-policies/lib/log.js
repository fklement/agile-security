var log = null;
var silent = (process.env.DEBUG_PDP !== "1");

function getLog() {
  if (log) {
    return log;
  } else {
    log = {
      log: function (string) {
        if (!silent)
          console.log("log info in agile-policies: " + string);
      },
      debug: function (string) {
        if (!silent)
          console.log("debug info in agile-policies: " + string);
      },
    };
    return log;
  }
}
module.exports = getLog();
