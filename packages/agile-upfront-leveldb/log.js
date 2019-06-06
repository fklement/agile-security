var log = null;
var silent = (process.env.DEBUG_POLICY_STORE !== "1");

function getLog() {
  if (log) {
    return log;
  } else {
    log = {
      log: function (string) {
        if (!silent)
          console.log("log info in agile-upfront-leveldb: " + string);
      },
      debug: function (string) {
        if (!silent)
          console.log("debug info in agile-uptront-leveldb: " + string);
      },
    };
    return log;
  }
}
module.exports = getLog();

