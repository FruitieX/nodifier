notifyer
========

A very simple CLI program capable of receiving notifications via HTTP POST.
Useful e.g. on a secondary monitor to list notifications from various sources.

Server
------

The server is a NodeJS program listening for notifications as HTTP POST
requests. Upon receiving a notification, the server prints the notification ID,
source and message to the console. In addition the server remembers the
notifications together with all of their POST fields, and they can be retrieved
later with GET requests with the notification ID as the requested resource.

Client
------

The client is also a very simple NodeJS program which retreives notifications
by ID from the server, and lists the previous X amount of notifications or
launches a specific notification's program/URL.

Usage
-----

TODO
