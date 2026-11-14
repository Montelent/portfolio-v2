# Admin access and Firebase setup

## Required before deploying these changes

Firestore writes now require the Firebase Authentication custom claim `admin: true`.
A normal signed-in account is deliberately not enough. Until the claim is assigned, the admin dashboard will reject that account and Firestore will deny writes.

### 1. Assign the administrator claim

Use a trusted machine with Node.js and the Firebase Admin SDK installed. Do not put a service-account JSON file or Admin SDK credentials in this repository or in any `VITE_*` environment variable.

Set Application Default Credentials for your Firebase project, then run a one-time script similar to:

```js
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

initializeApp({ credential: applicationDefault() });

const uid = 'REPLACE_WITH_YOUR_FIREBASE_AUTH_USER_UID';
const auth = getAuth();
const user = await auth.getUser(uid);

await auth.setCustomUserClaims(uid, {
  ...(user.customClaims ?? {}),
  admin: true,
});

console.log(`Administrator claim assigned to ${uid}`);
```

Find the UID in Firebase Console → Authentication → Users. Run this only from a trusted environment with permission to administer the Firebase project.

After assigning the claim, sign out of the portfolio admin page and sign in again so Firebase issues a token containing the new claim.

### 2. Deploy Firestore rules

From the project directory, deploy the updated rules:

```sh
firebase deploy --only firestore:rules
```

Review the Firebase project selected by the CLI before deploying. The rules intentionally keep portfolio content publicly readable while restricting writes to users whose verified ID token contains `admin: true`.

### 3. Review existing Firestore content

The old starter data included another developer's identity, projects, contact details, and certificates. New empty databases now receive Montelent-safe defaults instead of those sample records.

This code change does not automatically rewrite an already-populated Firestore database. Back up your existing data, inspect the `projects`, `skills`, `experiences`, `certificates`, and `config/siteConfig` collections, and replace any starter/template content with your own. The admin dashboard's reset action now clears those four content collections before restoring the safe defaults, so use it only after confirming you want to discard their current contents.

## Security notes

- Never expose Firebase Admin SDK credentials in frontend code.
- Firebase web configuration values are client-side identifiers, not admin credentials; Firestore rules remain the authorization boundary.
- Cloudinary upload presets must also enforce allowed formats, file-size limits, and unsigned-upload restrictions in the Cloudinary dashboard. Browser-side checks improve feedback but are not a security boundary.
