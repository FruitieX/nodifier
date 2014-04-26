nodifier
=========

![Screenshot](/screenshot.png?raw=true "Screenshot")

nodifier is a simple notification server complete with a client, both written
in NodeJS. Standalone programs known as plugins can add new notifications to
the server, eg. e-mails and IRC highlights. You can easily write your own
plugins by having a look at the API below!

### Features:
* Simple HTTPS REST API. Notifications sent as JSON.
* The nodifier client can be used to list (un)read notifications, mark one or several as (un)read, and open a program associated with a notification.
* The nodifier server prints unread notifications to STDOUT whenever the list changes, making it useful on a secondary monitor.
* Plugins can associate notifications with a program and an URI to pass as an argument to that program. This way you can e.g. open a web browser directly to the URL of a received e-mail.
* Plugins can be told when a notification has been read, and can then e.g. mark an e-mail as read. Works vice-versa, too.
* Free Open Source Software! (MIT License)

Config - `config.json`
----------------------
Take a look at the `config.json.example` file. This file is shared between
server and client. These can of course run on separate hosts. Fill in the
details of your server and other options you want, then save as `config.json`.

### Options
* `host`: Hostname of your server
* `port`: Port your server listens on
* `autoMarkRead`: When client only requests one notification, should it me
  marked read? (true/false)
* `ssl-key`: Relative path to the server SSL key
* `ssl-cert`: Relative path to the server SSL certificate
* `programs`: For safety, a list of applications a notification can be
  associated with and what command should be ran

Config - `htpasswd.json`
------------------------
This configuration file contains the credentials that will be used for basic
HTTP authentication. Recommended to choose a strong random password, you don't
need to remember it either as the client and server uses the same file.

See `htpasswd.json.example` for an example, then save it as `htpasswd.json`.

Client - `nodifier_cl.js`
-------------------------
### Supported commands:
* If the client is ran without any arguments, all notifications will be listed
* `lr`: List read (old) notifications
* `<id>`: List notification with matching `id`, if notification specifies
  program to launch it will be launched. If `autoMarkRead` is enabled, the
  notification will be marked as read. Supports ranges.
* `r <id>`: Mark `id` as read, supports ranges
* `u <id>`: Mark `id` from list of read notifications as unread, supports
  ranges

Ranges can be specified as such, both limits are inclusive: `37..42`
Either limit can be left out to match indices before/after:
* `..37`: Matches every index up to and including `37`.
* `37..`: Matches every index from `37` and up.

Handy aliases for your shell:
`alias n="~/path/to/nodifier_cl.js"`
`alias nr="n r"`
`alias nu="n u"`

Server - `nodifier_sv.js`
-------------------------
### Setup
1. Generate SSL keys with `./gen_keys.sh`
2. Run `nodifier_sv.js` in a terminal where you want notifications to show up.
3. Test with e.g. `plugins/spam/plugin.js`

Now the server is not very useful alone without anything sending notifications
to it, but there are a few scripts in this repo (under `plugins/`) that do just
that (such as the above spam script).  Have a look and/or script your own!

Plugins
-------
### Included, these make use of your `htpasswd.json` and `config.json` (via `lib/post.js`)
* Mail notifier
* Simple program for adding a TODO as a notification
* Test plugin

These can be ran in one node process via `plugins.js`
### Other projects
* znc-push, using URI service. Setup example:
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
------
The server speaks HTTPS and uses basic HTTP authentication. Here's a list of
notification properties that the server cares about, many can be left empty:
* `method`: What the server should do with this notification. Valid values are:
  `newNotification`, `setRead`, `setUnread`. Must be set when using POST, does
  nothing when using GET.
* `text`: Text of the notification. Only makes sense with `newNotification`.
* `source`: (optional) This is displayed right of the notification ID in the
  server/client and is used to categorize notifications. Can be used as a
  search criteria.
* `sourcebg` and `sourcefg`: (optional) Color of source string. See list of
  possible values at: `lib/clc-color.js`
* `context`: (optional) This is displayed right of the source string, and can
  be used to further categorize notifications. Can be used as a search
  criteria.
* `contextbg` and `contextfg`: (optional) Color of context string. See list of
  possible values at: `lib/clc-color.js`
* `uid`: (optional) Can be set by plugin to uniquely identify notifications
  even if their indices change. Only one notification with the same UID, source
  and context is allowed, old ones are replaced. UID will be sent along
  read/unread updates to plugin. Can be used as a search criteria.
* `id`: (optional) Only used for `setRead` and `setUnread` methods. Supports
  ranges.
* `openwith`: (optional) Specify which program the notification should be
  opened with.
* `url`: (optional) Specify an argument to be passed to the `openwith` program.
* `response_host`: (optional) Specify which hostname the plugin listens on. If
  given, the server will send a GET to given hostname on `response_port`,
  resource is: `/read/<uid>` or `/unread/<uid>`.
* `response_port`: (optional) Specify which port the plugin listens on.
* `noSendResponse`: (optional) If set to `true`, the server will not send
  read/unread updates to the plugin even if `response_host` and `response_port`
  are given.

Notifications can include any properties, the server will just pass on any
unknown ones.

### POST request (adding/manipulating notifications)
Resource is always `/`, with a querystring to describe the notification, e.g:
`/?method=setRead&source=irc&context=foo`. I use JSON here for clarity
purposes.  Use `querystring.stringify(data_json)` to go from JSON to query
string.

* Add a notification
```
{
	"method": "newNotification",
	"text": "lorem ipsum",
	"source": "mail",
	"sourcebg": "green",
	"sourcefg": "black"
	"context": "gmail",
	"contextbg": "red",
	"contextfg": "whiteBright",
	"uid" "1234567890foo"
	"openwith": "browser",
	"url": "http://awesome-mail-provider.com/inbox/847295819",
}
```
* Mark notification(s) as read
Mark notification with `id` equal to `42` as read:
```
{
	"method": "setRead",
	"id": 42
}
```
Mark all notifications with `source` set to `mail` as read:
```
{
	"method": "setRead",
	"source": "mail"
}
```
* Mark notification(s) as unread
Mark notification with uid `123abc` as unread:
```
{
	"method": "setUnread",
	"uid": "123abc"
}
```

### GET request (listing notifications)
* Request a list of all notifications
	* Resource: `/all`, returns something like:
```
[
	{"text":"spam0","source":"source0","app":"app0","url":"url0","sourcebg":"red","sourcefg":"white","read":false,"id":0,"date":1392663071818},
	{"text":"spam1","source":"source1","app":"app1","url":"url1","sourcebg":"red","sourcefg":"white","read":false,"id":1,"date":1392663072816},
	{"text":"spam2","source":"source2","app":"app2","url":"url2","sourcebg":"red","sourcefg":"white","read":false,"id":2,"date":1392663073816}
]
```

* Request a specific notification
	* Resource: `/<notification-id>`, returns something like:
```
{
	"text":"spam","source":"source0","sourcebg":"green","sourcefg":"black","app":"app0","url":"url0","read":false,"id":0,"date":1392663071818
}
```
