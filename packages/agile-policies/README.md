#Actions

the root for the actions is obtained from conf['action-policy-root'] and this pdp evaluates the following actions:

* self: whether the user read or write the entity as a whole. Write includes create update or delete (read write)
* policy: whether the user can read or write the policy for the whole entity (read or write)
