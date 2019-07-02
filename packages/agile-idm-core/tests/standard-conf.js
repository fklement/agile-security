var helper = require('../test-helpers');
var storage_config, upfront_config;
if (process.env.DB_TYPE == "mongodb") {
  storage_config = {
    dbName: "admin",
    type: "mongodb",
    host: "localhost",
    port: 27017,
    password: "secret",
    user: "agile",
    entityCollection: "entities",
    groupCollection: "groups",
  };
  upfront_config = {
    type: "mongodb",
    host: "localhost",
    port: 27017,
    password: "secret",
    user: "agile",
    dbName: "admin",
    collection: "policies"
  };
} else {
  storage_config = {
    "dbName": "./database"
  };
  upfront_config = {
    module_name: "agile-upfront-leveldb",
    type: "external",
    dbName: "./pap-database",
    collection: "policies"
  };
}
module.exports = {
  storage: storage_config,
  upfront_storage: upfront_config,
  "policies": {
    "create_entity_policy": [
      // actions of an actor are not restricted a priori
      {
        op: "write"
      },
      {
        op: "read"
      }
    ],
    "top_level_policy": {
      flows: [
        // all properties can be read by everyone
        {
          op: "read"
        },
        // all properties can only be changed by the owner of the entity
        {
          op: "write",
          locks: [{
            lock: "hasType",
            args: ["/user"]
          }, {
            lock: "isOwner"
          }]
        },
        {
          op: "write",
          locks: [{
            lock: "hasType",
            args: ["/user"]
          }, {
            lock: "attrEq",
            args: ["role", "admin"]
          }]
        }
      ],
      //specify what should happen if the policy does not comply
      actions: {
        "read": [{
          action: "delete"
        }]
      }
    },
    //default policy for policy field
    "policy-policy-root": {
      attribute: "policies",
      policy: [{
          op: "read",
          locks: [{
            lock: "hasType",
            args: ["/user"]
          }, {
            lock: "isOwner"
          }]
        },
        // by all users with role admin
        {
          op: "read",
          locks: [{
            lock: "hasType",
            args: ["/user"]
          }, {
            lock: "attrEq",
            args: ["role", "admin"]
          }]
        },
        {
          op: "write",
          locks: [{
            lock: "hasType",
            args: ["/user"]
          }, {
            lock: "isOwner"
          }]
        },
        // by all users with role admin
        {
          op: "write",
          locks: [{
            lock: "hasType",
            args: ["/user"]
          }, {
            lock: "attrEq",
            args: ["role", "admin"]
          }]
        }
      ],
      readAll: [{
        op: "read"
      }]
    },
    //restricts the policy composition tree (policy.policy) read only  = 1 (policy.policy.policy) = 2
    //in other terms 1 does not allow for policy updates, 2 allows for policy update but no meta-policy update, etc.
    "policy-level": 1,
    "action-policy-root": {
      attribute: "actions",
      policy: [{
          op: "read",
          locks: [{
            lock: "hasType",
            args: ["/user"]
          }, {
            lock: "isOwner"
          }]
        },
        // by all users with role admin
        {
          op: "read",
          locks: [{
            lock: "hasType",
            args: ["/user"]
          }, {
            lock: "attrEq",
            args: ["role", "admin"]
          }]
        },
        {
          op: "write",
          locks: [{
            lock: "hasType",
            args: ["/user"]
          }, {
            lock: "isOwner"
          }]
        },
        // by all users with role admin
        {
          op: "write",
          locks: [{
            lock: "hasType",
            args: ["/user"]
          }, {
            lock: "attrEq",
            args: ["role", "admin"]
          }]
        }
      ]
    },
    "attribute_level_policies": {
      "user": {
        "password": [
          // the property can only be read by the user itself
          {
            op: "read",
            locks: [{
              lock: "hasType",
              args: ["/user"]
            }, {
              lock: "isOwner"
            }]
          }
          // the property can be set by the user itself and
          , {
            op: "write",
            locks: [{
              lock: "hasType",
              args: ["/user"]
            }, {
              lock: "isOwner"
            }]
          },
          // by all users with role admin
          {
            op: "write",
            locks: [{
              lock: "hasType",
              args: ["/user"]
            }, {
              lock: "attrEq",
              args: ["role", "admin"]
            }]
          }
        ],
        "role": [
          // can be read by everyone
          {
            op: "read"
          },
          // can only be changed by users with role admin
          {
            op: "write",
            locks: [{
              lock: "hasType",
              args: ["/user"]
            }, {
              lock: "attrEq",
              args: ["role", "admin"]
            }]
          }
        ]
      },
      "sensor": {
        "credentials": [
          // the property can only be read by the user itself
          {
            op: "read",
            locks: [{
              lock: "hasType",
              args: ["/user"]
            }, {
              lock: "isOwner"
            }]
          },
          // the property can be set by the user itself and
          {
            op: "write",
            locks: [{
              lock: "hasType",
              args: ["/user"]
            }, {
              lock: "isOwner"
            }]
          },
          // by all users with role admin
          {
            op: "write",
            locks: [{
              lock: "hasType",
              args: ["/user"]
            }, {
              lock: "attrEq",
              args: ["role", "admin"]
            }]
          }
        ]
      }

    }
  },
  "forbidden-attribute-names": [
    'id',
    'type',
    'owner',
    'groups',
    'entities',
    'actions',
    'policy'
  ],
  "schema-validation": [{
    "id": "/sensor",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "name": {
        "type": "string"
      },
      "token": {
        "type": "string"
      }
    },
    "required": ["name"]
  }, {
    "id": "/user",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "user_name": {
        "type": "string"
      },
      "auth_type": {
        "type": "string"
      },
      "password": {
        "type": "string"
      },
      "role": {
        "type": "string"
      },
      "credentials": {
        "type": "object",
        "additionalProperties": true,
        "properties": {
          "dropbox": {
            "type": "string"
          }
        }
      }
    },
    "required": ["user_name", "auth_type"]
  }, {
    "id": "/other",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "name": {
        "type": "string"
      },
      "token": {
        "type": "string"
      }
    },
    "required": ["name"]
  }],
  "audit": {
    dbName: "database_",
    //according to https://www.npmjs.com/package/timeframe-to-seconds,
    timeframe: '1m',
    //DETAILED=0, ONLY_IMPORTANT_STUFF=1
    level: 1,
    regex: '^actions'
    //regex in case we want to log only certain
  }
};