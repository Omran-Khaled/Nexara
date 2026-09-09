FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends clamav-daemon clamav-freshclam \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /service
COPY server.mjs ./server.mjs
COPY start.sh ./start.sh
RUN chmod 0555 ./start.sh \
  && useradd --system --uid 10001 --create-home scanner

ENV PORT=8080 \
    CLAMD_HOST=127.0.0.1 \
    CLAMD_PORT=3310 \
    SCANNER_MAX_BYTES=52428800
EXPOSE 8080
USER scanner
ENTRYPOINT ["./start.sh"]
