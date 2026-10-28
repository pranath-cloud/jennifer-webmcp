#!/bin/bash
/usr/bin/systemctl stop nginx
/usr/local/bin/lego --accept-tos --email ops@tendrilsioservices.com --domains webmcp.tendrilsioservices.com --domains webmcp-v2.tendrilsioservices.com --tls --tls.port :443 --path /etc/lego-certs renew --days 30
/usr/bin/systemctl start nginx
/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx
