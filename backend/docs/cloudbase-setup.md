# Cloud Development Setup

## What is verified locally

- The backend schema and local user store are implemented.
- No CloudBase CLI was found on this machine.
- The user supplied the CloudBase environment ID `ad-scd-dev-d1g1y08v5962945fd`.
- No Tencent Cloud credential or WeChat application credential is available to this workspace.
- Therefore no cloud database connection, cloud function, or cloud storage deployment has been performed by this agent.
- The user later provided screenshots showing PostgreSQL tables, the private bucket
  `ad-scd-files`, and two `storage.objects` policies for the `authenticated` role.
  These are user-provided results and were not directly executed by this agent.

## Actions required in the Tencent Cloud console

1. Open or select the environment `ad-scd-dev-d1g1y08v5962945fd`.
2. Confirm that the selected database is PostgreSQL, then obtain its SQL editor or standard PostgreSQL connection information.
3. Execute `sql/001_init.sql` to create the seven tables listed in `docs/database.md`.
4. Enable cloud storage and create separate prefixes for scale assets and uploaded reports.
5. Configure the cloud function runtime for Node.js and deploy the backend entry point.
6. Configure database and storage security rules so clients cannot directly read or write sensitive participant data.
7. Create one real administrator account through the selected identity method.
8. Put provider credentials in the cloud secret manager, never in source files.
9. Send the environment ID, database type, cloud function entry format, and storage configuration to the backend owner.

## Required values from the team

```text
CLOUD_ENV_ID=ad-scd-dev-d1g1y08v5962945fd
cloud database type=
cloud function entry format=
storage bucket or environment storage name=
mini-program app identity configuration=
web admin domain or local development origin=
```

## Important limitation

Setting `CLOUD_ENV_ID` alone does not connect the application. A CloudBase SDK adapter and deployed security rules are still required. The current health endpoint reports `configured_not_connected` when an environment ID is present, rather than claiming a successful cloud connection.
