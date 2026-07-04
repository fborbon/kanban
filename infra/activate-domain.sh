#!/usr/bin/env bash
# Run this AFTER adding the DNS CNAME records below and the cert is ISSUED
# Check cert status: aws acm describe-certificate --certificate-arn arn:aws:acm:us-east-1:295936871972:certificate/8c63a729-7549-4ac5-bdc9-587bb357fafa --region us-east-1 --query "Certificate.Status"

set -e

DIST_ID="E1AQDWOGNRBTEY"
CERT_ARN="arn:aws:acm:us-east-1:295936871972:certificate/8c63a729-7549-4ac5-bdc9-587bb357fafa"

echo "Fetching current distribution config..."
ETAG=$(aws cloudfront get-distribution-config --id $DIST_ID --query ETag --output text)
aws cloudfront get-distribution-config --id $DIST_ID --query DistributionConfig > /tmp/current-cf.json

echo "Patching aliases and certificate..."
python3 - <<'PYEOF'
import json, sys

with open('/tmp/current-cf.json') as f:
    cfg = json.load(f)

cfg['Aliases'] = {"Quantity": 1, "Items": ["scrum.forwardforecasting.eu"]}
cfg['ViewerCertificate'] = {
    "ACMCertificateArn": "arn:aws:acm:us-east-1:295936871972:certificate/8c63a729-7549-4ac5-bdc9-587bb357fafa",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021",
    "CloudFrontDefaultCertificate": False
}

with open('/tmp/updated-cf.json', 'w') as f:
    json.dump(cfg, f)

print("Config patched.")
PYEOF

echo "Updating distribution..."
aws cloudfront update-distribution \
  --id $DIST_ID \
  --if-match $ETAG \
  --distribution-config file:///tmp/updated-cf.json \
  --query "Distribution.Status" --output text

echo ""
echo "✅ Domain configured. Distribution is deploying (takes ~5 min)."
echo "   Now add CNAME in your DNS provider:"
echo "   scrum.forwardforecasting.eu → dj8fh2qub7vc.cloudfront.net"
