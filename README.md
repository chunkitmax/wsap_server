# WSAP_Server

## Setup
```bash
# make sure this file has execute permission
$ chmod +x start_docker.sh
# install all dependencies + (global typescript & apidoc)
$ npm install
```

## Run
```bash
# debug (w/ VNC support port 5900)
$ ./start_docker.sh debug
# or
$ ./start_docker.sh

$ npm start
```

## Endpoints
Generate documentation
```bash
$ npm run doc
```
Then open ./doc/index.html in the browser