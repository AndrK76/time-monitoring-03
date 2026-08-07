FROM nginx:alpine

RUN echo "Build date: $(date)" > /tmp/build-date.txt


COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

#CMD ["sh", "-c", "echo 'Ready for inspect' && tail -f /dev/null"]
CMD ["nginx", "-g", "daemon off;"]

