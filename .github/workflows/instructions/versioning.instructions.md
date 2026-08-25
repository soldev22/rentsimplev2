---
applyTo: "**"
---

When modifying this application:

1. Maintain a version number in the format:
   Major.Minor.Build
   Example: 1.0.15

2. Only increment the Build number for routine changes. Increment the Minor number (and reset Build to 0) for new features. Increment the Major number (and reset Minor and Build to 0) for breaking changes, unless instructed otherwise.

3. Update the Published date and time to the value explicitly provided by the user, or prompt the user to supply the current date and time if not provided.

4. The version number and published date must appear in the footer of the home page.

5. Footer format:

Version: 1.0.15
Published: 14 August 2026 15:30

6. If the footer does not exist, create one.

7. Preserve all previous functionality when updating version information.

8. Never remove version history comments if they already exist.

9. After making changes, report:
   - Previous version
   - New version
   - Published date/time

10. If any database records are to be created, they will need to have full CRUD capability, including: API endpoints, data access layer, and any required UI components.