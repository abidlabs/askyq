#!/usr/bin/env python3
import json
import os
import subprocess
import sys

DOMAIN = os.environ.get("DOMAIN", "askqadi.org").rstrip(".")
PAGES_HOST = os.environ.get("GITHUB_PAGES_TARGET", "abidlabs.github.io").rstrip(".")

A_IPV4 = [
    "185.199.108.153",
    "185.199.109.153",
    "185.199.110.153",
    "185.199.111.153",
]
A_IPV6 = [
    "2606:50c0:8000::153",
    "2606:50c0:8001::153",
    "2606:50c0:8002::153",
    "2606:50c0:8003::153",
]


def zone_id() -> str:
    z = os.environ.get("HOSTED_ZONE_ID")
    if z:
        return z.removeprefix("/hostedzone/")
    out = subprocess.check_output(
        [
            "aws",
            "route53",
            "list-hosted-zones-by-name",
            "--dns-name",
            f"{DOMAIN}.",
            "--query",
            "HostedZones[0].Id",
            "--output",
            "text",
        ],
        text=True,
    ).strip()
    if not out or out == "None":
        print("No hosted zone for", DOMAIN, file=sys.stderr)
        sys.exit(1)
    return out.removeprefix("/hostedzone/")


def main() -> None:
    zid = zone_id()
    changes = [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": DOMAIN,
                "Type": "A",
                "TTL": 300,
                "ResourceRecords": [{"Value": ip} for ip in A_IPV4],
            },
        },
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": DOMAIN,
                "Type": "AAAA",
                "TTL": 300,
                "ResourceRecords": [{"Value": ip} for ip in A_IPV6],
            },
        },
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": f"www.{DOMAIN}",
                "Type": "CNAME",
                "TTL": 300,
                "ResourceRecords": [{"Value": f"{PAGES_HOST}."}],
            },
        },
    ]
    batch = {"Comment": f"GitHub Pages {DOMAIN}", "Changes": changes}
    subprocess.run(
        [
            "aws",
            "route53",
            "change-resource-record-sets",
            "--hosted-zone-id",
            zid,
            "--change-batch",
            json.dumps(batch),
        ],
        check=True,
    )
    print("Applied UPSERT to zone", zid, "for", DOMAIN, "www ->", PAGES_HOST)


if __name__ == "__main__":
    main()
