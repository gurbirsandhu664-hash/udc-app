# UDC Ultimate V16

UDC-only practice classifier with 2700-title key, semantic fallback, and UDC Review Chat.

## New in V16
- Editable title input.
- Review Chat for discussing a title and current classification.
- Manual verified correction form.
- Corrections are checked before the main 2700-title key.
- `/api/corrections` stores corrections in `udc-corrections.json`.

## Important
The correction file is local to the running server. Render free instances can lose local filesystem changes after restart/redeploy. For permanent corrections, commit the correction JSON to the repository or connect a persistent database.

## Run
`npm start`
