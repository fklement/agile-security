module.exports.buildConfig = function (config) {
  config.upfront = {
    ulocks: {
      entityTypes: {
        "/any": 0,
        "/group": 1,
        "/user": 2,
        "/api": 5,
        "/const": 6,
        "/attr": 6,
        "/prop": 6,
        "/var": 6,
      },
      opTypes: {
        write: 0,
        read: 1
      },
      load_from_module: "agile-upfront-locks",
      locks: "module",
      actions: "module"
    },
    pdp: {

    },
    pap: {
      storage: config.upfront_storage
    }
  };
  config['schema-validation'].forEach(function (s) {
    if (s.id !== '/user') {
      config.upfront.ulocks.entityTypes[s.id] = 3;
    }
  });

  //in case custom locks and actions are needed (e.g. unit testing.)
  if (config.custom_locks && config.custom_actions) {
    config.upfront.ulocks.locks = config.custom_locks;
    config.upfront.ulocks.actions = config.custom_actions;
  }

  return config;

};
