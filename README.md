nodifier
========

![Screenshot](/screenshot.png?raw=true "Screenshot")

nodifier is a simple, general purpose notification server using Node TLS.
Client programs can query the server for notifications, mark notifications as (un)read
and add new notifications. Connected clients will receive updates of new/changed notifications.

Several clients can stay connected at once, enabling you to share notifications across
several devices and services. Examples of client programs included with nodifier:

* CLI client - List (un)read notifications, mark notifications as (un)read, open URLs associated with notifications in a browser and more, all from the terminal!
* "Todo client" - Simple client program for adding tasks as new notifications.
* IMAP mail bridge - Adds/removes notifications when new mail arrives or when mail is marked as (un)read. Also works vice versa: marks mail on the IMAP server as (un)read if a notification is marked as (un)read.
* HTTP bridge - Exposes a HTTP REST API for clients where implementing Socket.IO might be challenging. As an example: a plugin for the ZNC IRC bouncer which adds notifications on IRC highlights, and marks old notifications as read when you reply on the same channel/private message.
* Desktop notifications - Pop up a message bubble / play a sound on your desktop PCs when new notifications arrive.

TODO:
* Mobile client - Send new notifications to an Android phone (via Google Cloud Messaging?). Possibility to mark as (un)read from the phone?
* Support more services

It's easy to write new clients!
Have a look at the template client and the API description below.

Setup
=====

config.js
-----------
Take a look at the `config/config.js.example` file. This file is shared between
server and client. These can of course run on separate hosts. Fill in the
details of your server and other options you want, then save as `config/config.js`.

Option          | Explanation
----------------|--------------
`host`          | Hostname of your server
`port`          | Port your server listens on
`numReadToKeep` | How many read notifications will be remembered.
`programs`      | For safety, a list of applications a notification can be associated with and what command should be ran

Server - `nodifier.js`
----------------------
1. Generate SSL keys with `config/gen_cert.sh`
2. Configure `config/config.js`
3. Run `nodifier.js`

Test with e.g. `clients/spam/spam.js`, and the CLI client listing notifications (see below)

CLI Client - `clients/cli/cli.js`
---------------------------------
### Supported commands:
If the client is ran without any arguments, all notifications will be listed

Argument    | Explanation
------------|------------------
`lr`        | List read (old) notifications
`<id>`      | List a notification with matching `id`, if the notification specifies program to launch it will be launched. If `autoMarkRead` is enabled, the notification will be marked as read. Supports ranges.
`r <id>`    | Mark `id` as read, supports ranges
`u <id>`    | Mark `id` from list of read notifications as unread, supports ranges
`l`         | Run the client in 'listen' mode, continuously printing new notifications to console

Ranges can be specified as such, both limits are inclusive: `37..42`
Either limit can be left out to match indices before/after:
* `..37`: Matches every index up to and including `37`.
* `37..`: Matches every index from `37` and up.

Handy aliases for your shell:
* `alias n="~/path/to/nodifier_cl.js"`
* `alias nr="n r"`
* `alias nu="n u"`

Misc clients
------------
### Included
These plugins make use of your `config/config.js` file to connect to the server.
Explanations at beginning of document.

* "Todo client" - `clients/todo/todo.js`
* IMAP mail bridge - `clients/mail/mail.js`
* HTTP bridge - `clients/httpbridge/httpbridge.js`
* Desktop notifications - `client/notify-send/notify-send.js`
* Template client - `client/template/template.js`

Most of these can simply be ran without any additional configuration, assuming
you have a `config/config.js` file the client can find. Some clients (eg. mail)
need additional configuring, example configuration files and scripts needed are included.

### Other projects
* znc-push, using HTTP bridge and ZNC URI service. Setup example:
```
set service url
set message_uri https://domain.org:8888/?method=newNotification&text={nick} {message}&sourcebg=green&sourcefg=black&source=irc&context={context}&contextbg=yellow&contextfg=black&openwith=irc
set message_uri_markasread https://domain.org:8888/?method=setRead&source=irc&context={context}
set mark_asread yes
set message_uri_post yes
set username http_auth_username
set secret http_auth_password
set highlight your_nick
```

Upstream znc-push currently puts a lot of extra stuff in `{message}`, and has
no support for `message_uri_markasread`. I've fixed/added these things in my
fork of znc-push, and maintain all changes inside my server branch over at:
[FruitieX/znc-push](https://github.com/FruitieX/znc-push/tree/fruitiex/server)

API
---
The server communicates over TLS sockets. Messages are sent as stringified
arrays containing an event as a first element and the data as the second element.
Notifications are sent as JSON, see valid properties below.

The included helper library `lib/connect.js` will take care of formatting by adding
a few methods to the exported socket object:

* socket.on('myEvent', function(data) { console.log(data); }
* socket.send('myOtherEvent', data);
* socket.on('open', function() { console.log('connection opened'); });

Here's a list of events the server responds to:

* `newNotification` store given notification. Pass the notification JSON object as data. Notification broadcast to all connected clients (including you) in a `newNotification` event containing the notification.
* `markAs` mark notification matching search terms as (un)read. Pass as data a JSON object of search terms with required field:
  * `read` (boolean: mark as read or unread)

  and optional fields:
  * `id` (integer or a range: 4..42)
  * `uid`
  * `source`
  * `context`

  Matched notifications sent back to you in a `notifications` event, and broadcast to all connected clients (excluding you) in a `markAs` event both containing a list of notifications.
* `getRead` sends you a list of all read notifications in a `notifications` event.
* `getUnread` sends you a list of unread notifications in a `notifications` event. Pass as optional data a JSON object of search terms, works the same as in `markAs`.

Here's a list of notification properties that the server/included CLI client
cares about, most of which can be left undefined. Any extra properties are
allowed, and they can be useful as they are just passed on to clients:

 Property                   | Explanation
----------------------------|-------------------
`text`                      | Text of the notification. Only makes sense with `newNotification`.
`source`                    | This is displayed right of the notification ID in the CLI client and is used to categorize notifications. Can be used as a search criteria.
`sourcebg` and `sourcefg`   | Color of source string. See list of possible values at: `lib/clc-color.js`
`context`                   | This is displayed right of the source string, and can be used to further categorize notifications. Can be used as a search criteria.
`contextbg` and `contextfg` | Color of context string. See list of possible values at: `lib/clc-color.js`
`uid`                       | Can be set by plugin to uniquely identify notifications even if their indices change. Only one notification with the same UID, source and context is allowed, duplicates are replaced. Can be used as a search criteria.
`openwith`                  | Specify which program the notification should be opened with.
`url`                       | Specify an argument to be passed to the `openwith` program.
