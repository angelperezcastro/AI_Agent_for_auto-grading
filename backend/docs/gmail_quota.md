# Gmail API Quota Note

This project uses the Gmail API to send automatic platform emails.

## Current expected email volume

Each student submission may trigger up to 3 emails:

1. Confirmation email to the student
2. Notification email to the professor
3. Feedback email to the student after AI evaluation

For a class of 30 students submitting 4 deliverables:

```text
30 students × 4 deliverables × 3 emails = 360 emails
This is below the typical Gmail sending limit of 500 emails/day for regular Gmail accounts.

Production consideration

For larger cohorts, this limit may become a bottleneck. A production deployment should consider:

Google Workspace account limits
Dedicated transactional email provider
Email queue with retry logic
Email audit log
Rate limiting