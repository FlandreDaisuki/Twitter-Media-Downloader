FROM node:14-alpine

WORKDIR /root

RUN apk add --no-cache tzdata youtube-dl

COPY index.js /root/index.js

RUN chmod +x index.js

CMD [ "/root/index.js" ]
