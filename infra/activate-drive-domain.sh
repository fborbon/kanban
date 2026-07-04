#!/usr/bin/env bash
# Run once after ACM cert is ISSUED and DNS CNAME for drive subdomain is added.
set -euo pipefail

DIST_ID="E1R8ATVFWDWFMO"
CERT_ARN="arn:aws:acm:us-east-1:295936871972:certificate/15c13b71-4c3c-4135-911f-f372d27c6dca"
DOMAIN="drive.forwardforecasting.eu"

echo "Checking cert status…"
STATUS=$(aws acm describe-certificate \
  --certificate-arn "$CERT_ARN" --region us-east-1 \
  --query "Certificate.Status" --output text)
echo "Cert status: $STATUS"
if [ "$STATUS" != "ISSUED" ]; then
  echo "Cert not yet ISSUED. Add the DNS validation CNAME, wait a few minutes, then re-run."
  exit 1
fi

echo "Getting current distribution config…"
ETAG=$(aws cloudfront get-distribution-config --id "$DIST_ID" --query "ETag" --output text)
aws cloudfront get-distribution-config --id "$DIST_ID" --query "DistributionConfig" > /tmp/drive-dist-cfg.json

echo "Patching config with custom domain + cert…"
python3 - << PYEOF
import json
with open('/tmp/drive-dist-cfg.json') as f:
    cfg = json.load(f)
cfg['Aliases'] = {'Quantity': 1, 'Items': ['$DOMAIN']}
cfg['ViewerCertificate'] = {
    'ACMCertificateArn': '$CERT_ARN',
    'SSLSupportMethod': 'sni-only',
    'MinimumProtocolVersion': 'TLSv1.2_2021',
    'Certificate': '$CERT_ARN',
    'CertificateSource': 'acm',
}
cfg.pop('CloudFrontDefaultCertificate', None)
with open('/tmp/drive-dist-cfg.json', 'w') as f:
    json.dump(cfg, f)
PYEOF

echo "Updating CloudFront distribution…"
aws cloudfront update-distribution \
  --id "$DIST_ID" \
  --distribution-config file:///tmp/drive-dist-cfg.json \
  --if-match "$ETAG" \
  --query "Distribution.{Id:Id,Status:Status,Domain:DomainName}" \
  --output json

echo ""
echo "Done. Add this DNS record if not already present:"
echo "  CNAME  drive.forwardforecasting.eu  →  d2ck05m982sz2b.cloudfront.net"
echo ""
echo "The distribution is deploying (~5 min). Then https://$DOMAIN/ will be live."
