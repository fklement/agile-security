#!/bin/bash

# This is meant to be used within the container...
# If you plan to run this in your machine for testing just do npm start.

export BASEP="$( cd "$(dirname "$0")" ; pwd -P )"

#export CONF=$BASEP/conf
#export DATA=$BASEP/conf
echo "configuration folder is $CONF"
echo "data folder is $DATA"
#CONF=/root/idm.conf/


if [ ! -f "$CONF/agile-idm-core-conf.js" ]; then
  echo "folder not there for conf"
  cp -r conf/* $CONF
fi


node $BASEP/app.js $CONF
