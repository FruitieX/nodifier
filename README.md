nodifier
=========

A very simple CLI server and client, both written in NodeJS, capable of storing notifications
via HTTP POST and retreiving stored notifications via HTTP GET.

Useful e.g. on a secondary monitor to list notifications from various sources, or maybe
you're just tired of picking up your phone to read a notification when you're already sitting
at your computer.

Server
------
The server speaks HTTP. Here's what it can do:

### POST request
Resource is always `/`, use `querystring.stringify(data_json)` to go from JSON to query string.
* Add a notification
```
{
	"method": "newNotification",
	"text": "lorem ipsum",
	"source": "mymail",
	"app": "web",
	"url": "http://awesome-mail-provider.com/inbox/847295819",
	"colorbg": "red",
	"colorfg": "whiteBright"
}
```
* Mark notification as read
```
{
	"method": "setRead",
	"id": 42
}
```
* Mark notification as unread
```
{
	"method": "setUnread",
	"id": 42
}
```

### GET request
* Request a list of all notifications
	* Resource: `/all`, returns something like:
```
[
	{"text":"spam0","source":"source0","app":"app0","url":"url0","colorbg":"red","colorfg":"white","read":false,"id":0,"date":1392663071818},
	{"text":"spam1","source":"source1","app":"app1","url":"url1","colorbg":"red","colorfg":"white","read":false,"id":1,"date":1392663072816},
	{"text":"spam2","source":"source2","app":"app2","url":"url2","colorbg":"red","colorfg":"white","read":false,"id":2,"date":1392663073816}
]
```

* Request a specific notification
	* Resource: `/<notification-id>`, returns something like:
```
{
	"text":"spam",
	"source":"source0",
	"app":"app0",
	"url":"url0",
	"colorbg":"green",
	"colorfg":"black",
	"read":false,
	"id":0,
	"date":1392663071818
}
```

Furthermore the server automatically logs unread notifications to the terminal
window from where it was ran. (and hides already read notifications, too)

### Setup

1. Generate SSL keys with `./gen_keys.sh`
2. `cp config.json.example config.json` (TODO: do this
   automatically?)
3. Edit `config.json`.
4. Run `nodifier_sv.js` in a terminal where you want notifications to show up.
5. Test with e.g. `plugins/spam/plugin.js`

Now the server is not very useful alone without anything sending notifications
to it, but there are a few scripts in this repo (under `plugins/`) that do just
that (such as the above spam script).  Have a look and/or script your own!

Client
------
The client can request all notifications, specific notifications only or mark a
notification as (un)read.

### Setup
1. Server and client shares the same `config.json` file, so if you did the above steps you should be set.
2. Run `nodifier_cl.js` in a terminal to test it.
3. Optional: Make an alias/symlink for quick access:
`ln -s ~/dev/nodifier/nodifier_cl.js n`

Plugins
-------
### Included
* Mail notifier
* Simple program for adding a TODO as a notification
### Other projects
* znc-push, using URI service. Setup example:
```
set service url
set message_uri https://domain.org:1234/?method=newNotification&text={nick} {message}&colorbg=green&colorfg=black&source=irc&context={context}&openwith=irc
set message_uri_post yes
set username http_auth_username
set secret http_auth_password
set highlight your_nick
```
