#!/bin/bash

#
# Generate self signed certificate/key for SSL
#

NAME=mailplugin
KEYNAME=$NAME-key.pem
CSRNAME=$NAME-csr.pem
CERTNAME=$NAME-cert.pem

openssl genrsa -out $KEYNAME 1024
openssl req -new -key $KEYNAME -out $CSRNAME
openssl x509 -req -in $CSRNAME -signkey $KEYNAME -out $CERTNAME
