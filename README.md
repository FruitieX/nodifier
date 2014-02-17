nodifier
=========

A very simple CLI program capable of receiving notifications via HTTP POST and
retreiving stored notifications via HTTP GET.
Useful e.g. on a secondary monitor to list notifications from various sources.

Server
------

## The server speaks HTTP. Here's what it can do:

### POST request
`(resource is always '/', use 'querystring.stringify(data\_json)')`
#### Add a notification
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
#### Mark notification as read
```
{
	"method": "setRead",
	"id": 42
}
```
#### Mark notification as unread
```
{
	"method": "setUnread",
	"id": 42
}
```

### GET request
#### Request a list of all notifications
`(resource '/all')`
Returns something like:
```
[
	{"text":"spam0","source":"source0","app":"app0","url":"url0","colorbg":"red","colorfg":"white","read":false,"id":0,"date":1392663071818},
	{"text":"spam1","source":"source1","app":"app1","url":"url1","colorbg":"red","colorfg":"white","read":false,"id":1,"date":1392663072816},
	{"text":"spam2","source":"source2","app":"app2","url":"url2","colorbg":"red","colorfg":"white","read":false,"id":2,"date":1392663073816}
]
```

#### Request a specific notification
`(resource '/<id>')`
Returns something like:
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

## Setup

1. cp cfg/config.json.example cfg/config.json (TODO: do this
   automatically?)
2. Edit the config file (config.json)
3. Run nodifier\_sv.js in a terminal where you want notifications to show up

Now the server is not very useful alone without anything sending notifications
to it, but there are a few scripts in this repo (under 'plugins/') that do just
that.  Have a look and/or script your own!

Client
------

The client is also a very simple NodeJS program which retreives notifications
by ID from the server, and lists the previous X amount of notifications or
launches a specific notification's program/URL.

Setup
-----

TODO
Optional: make an alias/symlink to the command for quick access
