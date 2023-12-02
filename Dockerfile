FROM node:20-alpine

WORKDIR /root

RUN apk add --no-cache tzdata yt-dlp

COPY index.js /root/index.js

RUN chmod +x index.js

CMD [ "/root/index.js" ]
