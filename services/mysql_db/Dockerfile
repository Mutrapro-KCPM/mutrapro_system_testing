FROM mysql:8.0

# Copy the initialization scripts directly into the image to bypass DooD bind mount issues
COPY ./init-scripts/ /docker-entrypoint-initdb.d/
