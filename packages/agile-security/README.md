agile-security[![Build Status](https://travis-ci.org/Agile-IoT/agile-security.svg?branch=master)](https://travis-ci.org/Agile-IoT/agile-security)


# AGILE Security components (formerly Agile Security Web now includes the PDP, PAP and Audit components)

To run an example you should use the details mentioned inside the Agile Security section.

## Agile Security

Agile Security has several submodules. Among them, are the agile-pdp, agile-idm-core.

The main responsibilities of Agile Security are the following:

* **Oauth2 provider**: Agile Security implements the authorization code grant of Oauth2. In turn, Agile Security can still use external identity providers such as google, github, or even the local operating system to authenticate users, depending on its configuration. This allows the AGILE framework and potentially other applications to rely on it to handle the authentication of their users.
* **User registration**:: Agile Security also handles the user registration and management. In this way only certain users are allowed to login in the gateway. This is of utmost importance when Agile Security relies on external identity providers, because otherwise any user with a valid account in the external identity provider would be able to log in.
* **Entity registration**: Agile Security is used to register entities, such as sensors, oauth2 clients, workflows, etc. This forms the basis for policy enforcement.
* **Entites' attributes management**: Agile Security allows users to manage their entity's attributes. It implements write and read policies on the data to provide attribute asurance, which then allows for the implementation of a wide range of access control mechanisms, such as role based access control among others.
* **Entity lookup**:  Agile Security allows users to lookup entities. To this end, users can provide a set of constraints specifying attribute name and value.
* **Entity attribute declasification**: Agile Security also declassifies attributes that are not readable by users that query IDM. For example, there may be certain attributes that can only be read by the entity owner, but not by the rest of the users.
* **Credential Management**: Thanks to the entity declassification functionality of Agile Security, it could configured to allow entities to store credentials (that are used to connect to external clouds or systems for example). Provided that the right policies are configured, IDM would only return this information to the entities allowed to read this information, e.g. the owner of the entity.
* **Group Management**: To simplify the policy definition for developers, users can define groups and add entities to them. This can provide an easy way to handle entities and to define security policies for them by referencing the group directly.

### Setting up a Running Example


Agile Security offers an oauth2 server which in turn can rely on third party Identity Providers (IdPs) to authenticate users in AGILE.
Currently, Agile Security supports the authorization code flow of Oauth2. As a result, every application acting as an Oauth2 client (using Agile Security as identity provider), must be first registered with Agile Security. To have a quick set-up running with a registered Oauth2 client please check the OAuth client example referenced below.

Given that a client is required, we provide two examples that can be used to build upon and get started using Agile Security.
To get a minimalistic example running with IDM, it is required to clone the "client" branch of the oauth2-example of idm located here (https://github.com/nopbyte/Agile Security-oauth2-client-example).

Another option is to not only use Agile Security as an identity provider, but also to use its capabilities to manage and register entities. For developers interested in this, the "api-client" branch of the oauth2-example contains an express web application, with a demo graphical user interface, that executes the REST calls to the REST Entity API when the user uses the browser to do basic operations on identities, such as reading, creation of entities, updating attributes, etc.

### Debug mode

If you define the following variable (to be 1) this module will print debugging information to stdout, and in case of exceptions, it will print the stack trace in the browser.

export DEBUG_IDM_WEB=1

If no variable is set, or if any other value different than 1 is set, this component runs in quiet mode.

To debug the agile-idm-core or the agile-idm-storage components that are within agile-security please set the environment variables DEBUG_IDM_CORE  or DEBUG_IDM_STORAGE to 1 respectively. These two components will log to stdout debugging information.

### Quick Start

You can run this component by doing

```
npm install
npm start
```

Also, if you want to run it as a container you can use the docker-compose file included in this repository in the following way

```
docker-compose build
docker-compose up
```

Afterwards, you will have a version of agile-security running in port 3000 in both cases. However, you still need to have an application to rely on agile-security as an IdP or as a PDP.  For this, please check our [samples](https://github.com/nopbyte/agile-security-samples) 



### Additional Documentation

[Architecture](https://github.com/Agile-IoT/agile-security/blob/master/docs/architecture.md)

[User Authentication](https://github.com/Agile-IoT/agile-security/blob/master/docs/authentication.md)

[Identity Model](https://github.com/Agile-IoT/agile-security/blob/master/docs/identity-model.md)

[Configuration of Identity Providers (such as google, github, pam authentication, etc)](https://github.com/Agile-IoT/agile-security/blob/master/docs/idps-configuration.md)

### Main open source projects used by Agile Security

Although Agile Security has more dependencies, the key open source components used are the following:

* **Express**: This framework is used as the basis for building the Agile Security web server. Along with express several middlewares were used to cope with body parsing, sesion handling, etc.
* **Passport**: Passport is an authentication framework with a live ecosystem of pluggins contributed by the open source community. It has been used to implement the athentication mechanisms used by Agile Security.
* **Oauth2-orize**: This framework uses passport to facilitate the construction of an Oauth2 server.
* **LevelDB**: LevelDB provides a lightweight key value database used by Agile Security and its submodules to store tokens, antities and groups.
* **UPFROnt**: the ULock Policy FRamewOrk (UPFRont) is used to support usage locks to apply enforcement to write and read actions on attributes.
