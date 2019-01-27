FLAG=$1

if [ ${FLAG,,} = 'debug' ]
then
  # debug (w/ VNC)
  docker run -d -p 4444:4444 -p 5900:5900 -v /dev/shm:/dev/shm selenium/standalone-firefox-debug
else
  docker run -d -p 4444:4444 -v /dev/shm:/dev/shm selenium/standalone-firefox
fi